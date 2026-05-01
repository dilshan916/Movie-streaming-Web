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
        
    def search_all(self, title: str, season: int = None, episode: int = None):
        """Searches all local sites in priority order."""
        
        # 1. Try Cineru.lk FIRST (Fastest, no headless Chrome needed!)
        print("[*] Trying Cineru.lk...")
        result = self.search_cineru(title, season, episode)
        if result: return result
        
        # 2. Try Piratelk.com (Also very fast, no Chrome needed!)
        print("[*] Falling back to Piratelk.com...")
        result = self.search_piratelk(title, season, episode)
        if result: return result
        
        # 3. Try BaiscopeLK (Slow, requires Chrome)
        print("[*] Falling back to BaiscopeLK...")
        result = self.search_baiscope(title, season, episode)
        if result: return result
            
        # 3. Try Zoom.lk
        print("[*] Falling back to Zoom.lk...")
        return self.search_zoom(title, season, episode)

    def search_cineru(self, title: str, season: int = None, episode: int = None):
        """
        Search Cineru.lk for subtitles matching the title.
        Uses pure 'requests' (Extremely fast, bypasses Chrome entirely!)
        """
        try:
            query = title
            print(f"[*] Searching Cineru.lk for: {query}")
            search_url = f"https://cineru.lk/?s={requests.utils.quote(query)}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            
            res = requests.get(search_url, headers=headers, timeout=10)
            if res.status_code != 200:
                print(f"[!] Cineru.lk blocked requests (HTTP {res.status_code})")
                return None
                
            soup = BeautifulSoup(res.text, 'html.parser')
            # Cineru uses article tags or div with class post
            articles = soup.find_all('article') or soup.find_all('div', class_=re.compile(r'post|item'))
            
            if not articles:
                print("[!] No results found on Cineru.lk")
                return None
                
            first_post = None
            for article in articles:
                title_elem = article.find('h2') or article.find('h3') or article.find('div', class_=re.compile(r'title'))
                if not title_elem: continue
                a_tag = title_elem.find('a')
                if not a_tag: continue
                first_post = a_tag['href']
                break
                
            if not first_post:
                return None
                
            print(f"[*] Found Cineru.lk post: {first_post}")
            
            # Go to the post page
            post_res = requests.get(first_post, headers=headers, timeout=10)
            post_soup = BeautifulSoup(post_res.text, 'html.parser')
            
            download_link = None
            for a in post_soup.find_all('a', href=True):
                href = a['href']
                if '.zip' in href.lower() or '.rar' in href.lower() or 'download' in href.lower() or 'drive.google' in href.lower():
                    if 'facebook' in href or 'twitter' in href: continue
                    download_link = href
                    break
                    
            if not download_link:
                print("[!] Could not find download link on Cineru.lk post")
                return None
                
            print(f"[*] Found Cineru.lk download link: {download_link}")
            
            dl_res = requests.get(download_link, headers=headers, timeout=15)
            if dl_res.status_code != 200:
                print(f"[!] Failed to download subtitle archive: HTTP {dl_res.status_code}")
                return None
                
            return self._extract_subtitle_from_archive(dl_res.content, download_link, season, episode)
            
        except Exception as e:
            print(f"[!] Cineru.lk scraper error: {e}")
            return None

    def search_piratelk(self, title: str, season: int = None, episode: int = None):
        """
        Search Piratelk.com for subtitles matching the title.
        Uses pure 'requests'.
        """
        try:
            query = title
            print(f"[*] Searching Piratelk.com for: {query}")
            search_url = f"https://piratelk.com/?s={requests.utils.quote(query)}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            
            res = requests.get(search_url, headers=headers, timeout=10)
            if res.status_code != 200:
                print(f"[!] Piratelk.com blocked requests (HTTP {res.status_code})")
                return None
                
            soup = BeautifulSoup(res.text, 'html.parser')
            articles = soup.find_all('article') or soup.find_all('div', class_=re.compile(r'post|item'))
            
            if not articles:
                print("[!] No results found on Piratelk.com")
                return None
                
            first_post = None
            for article in articles:
                title_elem = article.find('h2') or article.find('h3') or article.find('div', class_=re.compile(r'title'))
                if not title_elem: continue
                a_tag = title_elem.find('a')
                if not a_tag: continue
                first_post = a_tag['href']
                break
                
            if not first_post:
                return None
                
            print(f"[*] Found Piratelk.com post: {first_post}")
            
            post_res = requests.get(first_post, headers=headers, timeout=10)
            post_soup = BeautifulSoup(post_res.text, 'html.parser')
            
            download_link = None
            for a in post_soup.find_all('a', href=True):
                href = a['href']
                if '.zip' in href.lower() or '.rar' in href.lower() or 'download' in href.lower():
                    if 'facebook' in href or 'twitter' in href: continue
                    download_link = href
                    break
                    
            if not download_link:
                print("[!] Could not find download link on Piratelk.com post")
                return None
                
            print(f"[*] Found Piratelk.com download link: {download_link}")
            
            dl_res = requests.get(download_link, headers=headers, timeout=15)
            if dl_res.status_code != 200:
                print(f"[!] Failed to download subtitle archive: HTTP {dl_res.status_code}")
                return None
                
            return self._extract_subtitle_from_archive(dl_res.content, download_link, season, episode)
            
        except Exception as e:
            print(f"[!] Piratelk.com scraper error: {e}")
            return None

    def search_zoom(self, title: str, season: int = None, episode: int = None):
        """
        Search Zoom.lk for subtitles matching the title.
        Uses undetected_chromedriver to bypass Cloudflare.
        """
        driver = None
        try:
            query = title
            print(f"[*] Searching Zoom.lk for: {query}")
            search_url = f"https://zoom.lk/?s={requests.utils.quote(query)}"
            
            driver = self.extractor.setup_driver()
            driver.get(search_url)
            
            print(f"[*] Waiting for Cloudflare bypass... Current title: '{driver.title}'")
            for _ in range(20):
                if "Just a moment" not in driver.title and "Cloudflare" not in driver.title:
                    break
                time.sleep(1)
            
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            # Zoom.lk usually uses standard WP loop (articles or post blocks)
            # They often use 'div' with class 'post' or 'item'
            articles = soup.find_all('article') or soup.find_all('div', class_=re.compile(r'post|item'))
            
            if not articles:
                print("[!] No results found on Zoom.lk")
                return None
                
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
                
            print(f"[*] Found Zoom.lk post: {first_post}")
            
            driver.get(first_post)
            time.sleep(3)
            post_soup = BeautifulSoup(driver.page_source, 'html.parser')
            
            # Find download link
            download_link = None
            for a in post_soup.find_all('a', href=True):
                href = a['href']
                if '.zip' in href.lower() or '.rar' in href.lower() or 'download' in href.lower():
                    # Ignore obvious non-subtitle links
                    if 'facebook' in href or 'twitter' in href: continue
                    download_link = href
                    break
                    
            if not download_link:
                print("[!] Could not find download link on Zoom.lk post")
                return None
                
            print(f"[*] Found Zoom.lk download link: {download_link}")
            
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
            print(f"[!] Zoom.lk scraper error: {e}")
            return None
        finally:
            if driver:
                try:
                    driver.quit()
                except:
                    pass

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
            
            # Wait dynamically for Cloudflare bypass (up to 20 seconds)
            print(f"[*] Waiting for Cloudflare bypass... Current title: '{driver.title}'")
            for _ in range(20):
                if "Just a moment" not in driver.title and "Cloudflare" not in driver.title:
                    break
                time.sleep(1)
            
            print(f"[*] Page loaded! Title is now: '{driver.title}'")
            
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

