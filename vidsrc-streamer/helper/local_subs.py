import time
import zipfile
import io
import re
import os
from bs4 import BeautifulSoup
import requests

try:
    import rarfile
except ImportError:
    rarfile = None

from .vidsrc_browser import VidSrcBrowserExtractor

class LocalSubtitleScraper:
    def __init__(self):
        self.extractor = VidSrcBrowserExtractor(headless=True)
        
    def search_baiscope(self, title: str, season: int = None, episode: int = None):
        """
        Search Baiscope.lk for subtitles matching the title, season, and episode.
        Uses undetected_chromedriver to bypass Cloudflare.
        """
        driver = None
        try:
            # For TV shows, searching specific episodes usually fails on BaiscopeLK because they group them.
            # We will just search the title, download the season pack, and extract the specific episode inside!
            query = title
            query_alt = title

            print(f"[*] Searching BaiscopeLK for: {query}")
            search_url = f"https://baiscope.lk/?s={requests.utils.quote(query)}"
            
            driver = self.extractor.setup_driver()
            driver.get(search_url)
            
            # Wait for Cloudflare bypass
            time.sleep(5)
            
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            articles = soup.find_all('article')
            
            # If no results, try alt query
            if not articles and query != query_alt:
                search_url = f"https://baiscope.lk/?s={requests.utils.quote(query_alt)}"
                driver.get(search_url)
                time.sleep(3)
                soup = BeautifulSoup(driver.page_source, 'html.parser')
                articles = soup.find_all('article')

            if not articles:
                print("[!] No results found on BaiscopeLK")
                return None

            # Get the first result's post URL
            first_post = None
            for article in articles:
                title_elem = article.find('h2') or article.find('h3')
                if not title_elem: continue
                a_tag = title_elem.find('a')
                if not a_tag: continue
                first_post = a_tag['href']
                break
                
            if not first_post:
                return None
                
            print(f"[*] Found post: {first_post}")
            
            # Navigate to the post
            driver.get(first_post)
            time.sleep(3)
            post_soup = BeautifulSoup(driver.page_source, 'html.parser')
            
            # Find the download button
            # Baiscope download buttons usually have class 'elementor-button-link' or similar, 
            # and href ending in .zip or .rar, or containing 'download'
            download_link = None
            for a in post_soup.find_all('a', href=True):
                href = a['href']
                if '.zip' in href.lower() or '.rar' in href.lower() or '/download/' in href.lower():
                    download_link = href
                    break
                    
            if not download_link:
                print("[!] Could not find download link on BaiscopeLK post")
                return None
                
            print(f"[*] Found download link: {download_link}")
            
            # Download the file
            # If the download link is protected by Cloudflare, we need to download it via the driver
            # But usually direct file links on baiscope are just regular downloads
            # We'll use requests first, if it fails (403), we use the driver cookies
            
            cookies = {c['name']: c['value'] for c in driver.get_cookies()}
            user_agent = driver.execute_script("return navigator.userAgent;")
            headers = {'User-Agent': user_agent, 'Referer': first_post}
            
            res = requests.get(download_link, headers=headers, cookies=cookies)
            if res.status_code != 200:
                print(f"[!] Failed to download subtitle archive: HTTP {res.status_code}")
                return None
                
            content = res.content
            return self._extract_subtitle_from_archive(content, download_link, season, episode)

        except Exception as e:
            print(f"[!] Baiscope scraper error: {e}")
            return None
        finally:
            if driver:
                try:
                    driver.quit()
                except:
                    pass

    def _extract_subtitle_from_archive(self, content: bytes, filename: str, season: int = None, episode: int = None):
        """Extracts the best matching .srt or .vtt file from a zip or rar archive in memory."""
        
        def is_match(name):
            name_lower = name.lower()
            if not (name_lower.endswith('.srt') or name_lower.endswith('.vtt')):
                return False
            
            # If it's a movie, any subtitle file is fine
            if not (season and episode):
                return True
                
            # If it's a TV show, look for episode patterns
            patterns = [
                f"s{season:02d}e{episode:02d}", f"s{season}e{episode}",
                f"{season}x{episode:02d}", f"e{episode:02d}", 
                f"ep {episode:02d}", f"ep{episode}", f"episode {episode}",
                f"episode {episode:02d}", f"e {episode:02d}"
            ]
            for p in patterns:
                if p in name_lower:
                    return True
                    
            # Fallback regex: look for the episode number as an isolated number
            # e.g., "True Beauty 01.srt"
            if re.search(rf"\b0*{episode}\b", name_lower):
                return True
                
            return False

        try:
            # ZIP File extraction
            if filename.lower().endswith('.zip') or content[:4] == b'PK\x03\x04':
                print("[*] Extracting ZIP file in memory...")
                with zipfile.ZipFile(io.BytesIO(content)) as z:
                    for name in z.namelist():
                        if is_match(name):
                            print(f"[*] Found matching subtitle: {name}")
                            sub_bytes = z.read(name)
                            return sub_bytes.decode('utf-8', errors='replace')
            
            # RAR File extraction
            elif filename.lower().endswith('.rar') or content[:4] == b'Rar!':
                if not rarfile:
                    print("[!] rarfile module is not installed. Cannot extract .rar!")
                    return None
                    
                print("[*] Extracting RAR file...")
                temp_path = "temp_sub.rar"
                with open(temp_path, "wb") as f:
                    f.write(content)
                    
                try:
                    with rarfile.RarFile(temp_path) as rf:
                        for info in rf.infolist():
                            if is_match(info.filename):
                                print(f"[*] Found matching subtitle: {info.filename}")
                                sub_bytes = rf.read(info)
                                return sub_bytes.decode('utf-8', errors='replace')
                finally:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                        
            print("[!] No matching .srt or .vtt found in archive for this episode")
            return None
            
        except Exception as e:
            print(f"[!] Error extracting archive: {e}")
            return None

