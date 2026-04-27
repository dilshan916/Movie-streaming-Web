#!/usr/bin/env python3
"""
VidSrc to M3U8 Extractor (Browser-based)
Uses Selenium to execute JavaScript and capture network requests
"""

import sys
import time
import json
import re
from urllib.parse import urlparse

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from webdriver_manager.chrome import ChromeDriverManager
    import undetected_chromedriver as uc
except ImportError:
    print("[!] Selenium not installed. Install with: pip install selenium")
    sys.exit(1)


class VidSrcBrowserExtractor:
    def __init__(self, headless=True):
        self.headless = headless
        self.m3u8_urls = []
        
    def setup_driver(self):
        """Setup undetected-chromedriver with network logging"""
        options = uc.ChromeOptions()
        
        if self.headless:
            options.add_argument('--headless=new')
            
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--autoplay-policy=no-user-gesture-required')
        
        # Enable logging
        options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
        
        try:
            import platform
            version_main = 147
            if platform.system() == 'Windows':
                import winreg
                try:
                    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Google\Chrome\BLBeacon')
                    version, _ = winreg.QueryValueEx(key, 'version')
                    version_main = int(version.split('.')[0])
                except:
                    pass
            driver = uc.Chrome(options=options, version_main=version_main)
            return driver
        except Exception as e:
            print(f"[!] Error setting up Chrome driver: {e}")
            print("[!] Make sure chromedriver is installed and in PATH")
            print("[!] Install with: pip install webdriver-manager")
            sys.exit(1)
    
    def extract_m3u8_from_logs(self, driver):
        """Extract M3U8 URLs from browser network logs"""
        m3u8_urls = []
        
        try:
            logs = driver.get_log('performance')
            
            for entry in logs:
                try:
                    log = json.loads(entry['message'])['message']
                    
                    # Look for network responses
                    if log['method'] == 'Network.responseReceived':
                        url = log['params']['response']['url']
                        
                        # Check if it's an M3U8 URL
                        if '.m3u8' in url:
                            m3u8_urls.append(url)
                            print(f"[+] Found M3U8 URL in network log: {url}")
                    
                    # Also check network requests
                    elif log['method'] == 'Network.requestWillBeSent':
                        url = log['params']['request']['url']
                        if '.m3u8' in url:
                            m3u8_urls.append(url)
                            print(f"[+] Found M3U8 URL in request: {url}")
                
                except (KeyError, json.JSONDecodeError):
                    continue
        
        except Exception as e:
            print(f"[!] Error reading logs: {e}")
        
        return list(set(m3u8_urls))
    
    def wait_for_player(self, driver, timeout=30):
        """Wait for video player to load"""
        print("[*] Waiting for player to load...")
        
        selectors = [
            'video',
            'iframe',
            '.player',
            '#player',
            '[class*="player"]',
            '[id*="player"]',
        ]
        
        for selector in selectors:
            try:
                element = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                print(f"[+] Found element: {selector}")
                return True
            except:
                continue
        
        return False
    
    def find_iframes(self, driver):
        """Find and switch to iframes"""
        iframes = driver.find_elements(By.TAG_NAME, 'iframe')
        print(f"[*] Found {len(iframes)} iframe(s)")
        return iframes
    
    def extract_from_embed(self, url, wait_time=15):
        """
        Extract M3U8 URL from VidSrc using browser automation
        """
        print(f"[*] Loading URL in browser: {url}")
        
        driver = self.setup_driver()
        
        try:
            # Load the page
            driver.get(url)
            print("[*] Page loaded, waiting for content...")
            
            # Wait a bit for page to load
            time.sleep(3)
            
            # Try to find and click play button if it didn't autoplay
            play_buttons = [
                '.play-button',
                '.vjs-big-play-button',
                '[class*="play"]',
                'button[aria-label*="play"]',
                '#play-now',
            ]
            
            for selector in play_buttons:
                try:
                    button = driver.find_element(By.CSS_SELECTOR, selector)
                    button.click()
                    print(f"[+] Clicked play button: {selector}")
                    break
                except:
                    continue
            
            # Wait for video to load
            self.wait_for_player(driver)
            
            # Check for iframes
            iframes = self.find_iframes(driver)
            
            # Wait for network activity
            print(f"[*] Waiting {wait_time} seconds for network requests...")
            time.sleep(wait_time)
            
            # Extract M3U8 URLs from network logs
            m3u8_urls = self.extract_m3u8_from_logs(driver)
            
            # Try switching to iframes and checking again
            for i, iframe in enumerate(iframes):
                try:
                    print(f"[*] Checking iframe {i+1}...")
                    driver.switch_to.frame(iframe)
                    time.sleep(2)
                    
                    # Try to click play in iframe
                    for selector in play_buttons:
                        try:
                            button = driver.find_element(By.CSS_SELECTOR, selector)
                            button.click()
                            print(f"[+] Clicked play in iframe {i+1}")
                            time.sleep(3)
                            break
                        except:
                            continue
                    
                    # Check logs again
                    new_urls = self.extract_m3u8_from_logs(driver)
                    m3u8_urls.extend(new_urls)
                    
                    driver.switch_to.default_content()
                except Exception as e:
                    print(f"[!] Error with iframe {i+1}: {e}")
                    driver.switch_to.default_content()
            
            return list(set(m3u8_urls))
        
        finally:
            driver.quit()
    
    def save_to_m3u8_file(self, urls, output_file='playlist.m3u8'):
        """Save URLs to M3U8 playlist file"""
        with open(output_file, 'w') as f:
            f.write('#EXTM3U\n')
            f.write('#EXT-X-VERSION:3\n\n')
            
            for i, url in enumerate(urls, 1):
                f.write(f'#EXTINF:-1,Stream {i}\n')
                f.write(f'{url}\n')
        
        print(f"[+] Saved to {output_file}")


def main():
    if len(sys.argv) < 2:
        print("VidSrc to M3U8 Extractor (Browser-based)")
        print("="*60)
        print("Usage: python vidsrc_browser.py <vidsrc_url> [options]")
        print("\nOptions:")
        print("  --output FILE    Output filename (default: playlist.m3u8)")
        print("  --wait SECONDS   Wait time for video load (default: 15)")
        print("  --show-browser   Show browser window (default: headless)")
        print("\nExample:")
        print("  python vidsrc_browser.py 'https://vidsrc.to/embed/movie/872585'")
        print("  python vidsrc_browser.py 'https://vidsrc.to/embed/tv/94605/1/1' --show-browser")
        sys.exit(1)
    
    url = sys.argv[1]
    output_file = 'playlist.m3u8'
    wait_time = 15
    headless = True
    
    # Parse arguments
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--output' and i + 1 < len(sys.argv):
            output_file = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--wait' and i + 1 < len(sys.argv):
            wait_time = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--show-browser':
            headless = False
            i += 1
        else:
            i += 1
    
    print("="*60)
    print("VidSrc M3U8 Extractor (Browser Mode)")
    print("="*60)
    print(f"URL: {url}")
    print(f"Wait time: {wait_time}s")
    print(f"Headless: {headless}")
    print("="*60)
    
    extractor = VidSrcBrowserExtractor(headless=headless)
    m3u8_urls = extractor.extract_from_embed(url, wait_time)
    
    if m3u8_urls:
        print("\n" + "="*60)
        print("[+] SUCCESS - Found M3U8 URLs:")
        print("="*60)
        for i, url in enumerate(m3u8_urls, 1):
            print(f"\n{i}. {url}")
        
        extractor.save_to_m3u8_file(m3u8_urls, output_file)
        
        print(f"\n[+] Play with: mpv {output_file}")
    else:
        print("\n[-] No M3U8 URLs found")
        print("\n[!] Try:")
        print("  1. Increase wait time: --wait 30")
        print("  2. Show browser to see what's happening: --show-browser")
        print("  3. Check if the video actually loads in browser")


if __name__ == '__main__':
    main()
