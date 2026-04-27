#!/usr/bin/env python3
"""
VidSrc to M3U8 Extractor (Enhanced)
Extracts M3U8 streaming URLs from VidSrc with improved detection
"""

import re
import sys
import json
import base64
import time
from urllib.parse import urlparse, parse_qs, unquote, urljoin
import requests

class VidSrcExtractor:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://vidsrc.to/',
            'Origin': 'https://vidsrc.to',
        })
        self.base_url = 'https://vidsrc.to'
    
    def find_all_scripts(self, html):
        """Extract all script contents from HTML"""
        script_pattern = r'<script[^>]*>(.*?)</script>'
        scripts = re.findall(script_pattern, html, re.DOTALL | re.IGNORECASE)
        return scripts
    
    def find_encoded_data(self, html):
        """Look for base64 or encoded data that might contain URLs"""
        results = []
        
        # Look for base64 encoded strings
        b64_pattern = r'["\']([A-Za-z0-9+/]{40,}={0,2})["\']'
        matches = re.findall(b64_pattern, html)
        
        for match in matches:
            try:
                decoded = base64.b64decode(match).decode('utf-8', errors='ignore')
                if 'm3u8' in decoded or 'http' in decoded:
                    results.append(decoded)
            except:
                pass
        
        return results
    
    def find_api_endpoints(self, html):
        """Find potential API endpoints"""
        endpoints = []
        
        patterns = [
            r'["\']([/a-zA-Z0-9_-]+/api/[^"\']+)["\']',
            r'fetch\(["\']([^"\']+)["\']',
            r'axios\.(?:get|post)\(["\']([^"\']+)["\']',
            r'["\'](/ajax/[^"\']+)["\']',
            r'["\']([^"\']*source[^"\']*)["\']',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            endpoints.extend(matches)
        
        return list(set(endpoints))
    
    def extract_vidsrc_sources(self, html, embed_url):
        """Extract source information from VidSrc embed page"""
        sources = []
        
        # Look for data-id attributes (VidSrc uses these)
        data_id_pattern = r'data-id=["\']([^"\']+)["\']'
        data_ids = re.findall(data_id_pattern, html)
        
        if data_ids:
            print(f"[*] Found {len(data_ids)} data-id value(s)")
            for data_id in data_ids:
                print(f"    - {data_id}")
        
        # Look for server/source selection
        server_pattern = r'data-(?:hash|server|source)=["\']([^"\']+)["\']'
        servers = re.findall(server_pattern, html)
        
        if servers:
            print(f"[*] Found {len(servers)} server/source identifier(s)")
        
        # Try to find the actual source API endpoint
        # VidSrc typically uses: /ajax/embed/source/{id} or similar
        source_api_pattern = r'["\']([^"\']*(?:ajax|api)[^"\']*(?:source|embed)[^"\']*)["\']'
        api_endpoints = re.findall(source_api_pattern, html, re.IGNORECASE)
        
        return {
            'data_ids': data_ids,
            'servers': servers,
            'api_endpoints': list(set(api_endpoints))
        }
    
    def try_source_api(self, data_id, embed_url):
        """Try to fetch source from VidSrc API"""
        # Common VidSrc API patterns
        api_patterns = [
            f'/ajax/embed/source/{data_id}',
            f'/api/source/{data_id}',
            f'/ajax/embed/episode/{data_id}/sources',
            f'/ajax/embed/movie/{data_id}/sources',
        ]
        
        for api_path in api_patterns:
            url = urljoin(self.base_url, api_path)
            print(f"[*] Trying API: {url}")
            
            try:
                response = self.session.get(url, headers={
                    'Referer': embed_url,
                    'X-Requested-With': 'XMLHttpRequest'
                })
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        print(f"[+] API Response: {json.dumps(data, indent=2)[:500]}")
                        
                        # Look for URL in response
                        url_found = self.extract_urls_from_json(data)
                        if url_found:
                            return url_found
                    except:
                        # Maybe it's not JSON
                        text = response.text
                        if 'm3u8' in text or 'http' in text:
                            print(f"[+] Response contains URL: {text[:500]}")
                            urls = self.extract_urls_from_text(text)
                            if urls:
                                return urls
            except Exception as e:
                print(f"[!] Error trying {url}: {e}")
        
        return []
    
    def extract_urls_from_json(self, data):
        """Recursively extract URLs from JSON data"""
        urls = []
        
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, str) and ('m3u8' in value or value.startswith('http')):
                    urls.append(value)
                else:
                    urls.extend(self.extract_urls_from_json(value))
        elif isinstance(data, list):
            for item in data:
                urls.extend(self.extract_urls_from_json(item))
        
        return urls
    
    def extract_urls_from_text(self, text):
        """Extract URLs from text"""
        url_pattern = r'https?://[^\s<>"\']+\.m3u8[^\s<>"\']*'
        return re.findall(url_pattern, text)
    
    def extract_from_embed(self, url):
        """
        Extract M3U8 URL from VidSrc embed page
        """
        print(f"[*] Fetching embed page: {url}")
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            html = response.text
            
            print(f"[*] Page loaded ({len(html)} bytes)")
            
            # Step 1: Look for direct M3U8 URLs
            print("\n[*] Step 1: Searching for direct M3U8 URLs...")
            m3u8_patterns = [
                r'file:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
                r'source:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
                r'src:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
                r'["\']([^"\']*https?://[^"\']*\.m3u8[^"\']*)["\']',
                r'url:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
            ]
            
            direct_urls = []
            for pattern in m3u8_patterns:
                matches = re.findall(pattern, html, re.IGNORECASE)
                direct_urls.extend(matches)
            
            if direct_urls:
                print(f"[+] Found {len(direct_urls)} direct M3U8 URL(s)")
                return list(set(direct_urls))
            
            # Step 2: Extract VidSrc-specific data
            print("\n[*] Step 2: Looking for VidSrc data structures...")
            vidsrc_data = self.extract_vidsrc_sources(html, url)
            
            # Step 3: Try to get sources from API
            all_urls = []
            if vidsrc_data['data_ids']:
                print("\n[*] Step 3: Attempting to fetch from source API...")
                for data_id in vidsrc_data['data_ids']:
                    urls = self.try_source_api(data_id, url)
                    all_urls.extend(urls)
            
            if all_urls:
                return list(set(all_urls))
            
            # Step 4: Look for encoded data
            print("\n[*] Step 4: Searching for base64 encoded data...")
            encoded_urls = self.find_encoded_data(html)
            if encoded_urls:
                print(f"[+] Found {len(encoded_urls)} decoded string(s)")
                for enc in encoded_urls[:3]:  # Show first 3
                    print(f"    - {enc[:100]}")
            
            # Step 5: Show all scripts for manual inspection
            print("\n[*] Step 5: Analyzing JavaScript...")
            scripts = self.find_all_scripts(html)
            print(f"[*] Found {len(scripts)} script blocks")
            
            # Look for interesting variable names in scripts
            interesting_vars = []
            for script in scripts:
                if any(keyword in script.lower() for keyword in ['source', 'player', 'video', 'stream', 'embed']):
                    # Extract variable assignments
                    var_pattern = r'(?:var|let|const)\s+(\w+)\s*=\s*["\']([^"\']{20,})["\']'
                    matches = re.findall(var_pattern, script)
                    interesting_vars.extend(matches)
            
            if interesting_vars:
                print(f"[*] Found {len(interesting_vars)} interesting variables")
                for var_name, var_value in interesting_vars[:5]:
                    print(f"    - {var_name} = {var_value[:80]}...")
            
            # Step 6: Show API endpoints found
            print("\n[*] Step 6: API endpoints discovered:")
            endpoints = self.find_api_endpoints(html)
            if endpoints:
                for ep in endpoints[:10]:
                    print(f"    - {ep}")
            else:
                print("    - None found")
            
            print("\n" + "="*60)
            print("[-] Could not automatically extract M3U8 URLs")
            print("="*60)
            print("\n[!] Manual extraction required. Try this:")
            print("1. Open the URL in your browser")
            print("2. Press F12 to open DevTools")
            print("3. Go to Network tab")
            print("4. Filter by 'm3u8' or 'master'")
            print("5. Play the video")
            print("6. Right-click the .m3u8 request → Copy → Copy URL")
            
            return []
            
        except requests.RequestException as e:
            print(f"[!] Error fetching embed page: {e}")
            return []
    
    def parse_vidsrc_url(self, url):
        """
        Parse VidSrc URL to extract movie/TV show info
        """
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split('/') if p]
        
        if 'movie' in path_parts:
            idx = path_parts.index('movie')
            return ('movie', path_parts[idx + 1] if len(path_parts) > idx + 1 else None, None, None)
        elif 'tv' in path_parts:
            idx = path_parts.index('tv')
            tmdb_id = path_parts[idx + 1] if len(path_parts) > idx + 1 else None
            season = path_parts[idx + 2] if len(path_parts) > idx + 2 else None
            episode = path_parts[idx + 3] if len(path_parts) > idx + 3 else None
            return ('tv', tmdb_id, season, episode)
        
        return (None, None, None, None)
    
    def save_to_m3u8_file(self, urls, output_file='playlist.m3u8'):
        """
        Save URLs to an M3U8 playlist file
        """
        with open(output_file, 'w') as f:
            f.write('#EXTM3U\n')
            f.write('#EXT-X-VERSION:3\n\n')
            
            for i, url in enumerate(urls, 1):
                f.write(f'#EXTINF:-1,Stream {i}\n')
                f.write(f'{url}\n')
        
        print(f"[+] Saved to {output_file}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python vidsrc_to_m3u8.py <vidsrc_embed_url> [output_file]")
        print("\nExample:")
        print("  python vidsrc_to_m3u8.py 'https://vidsrc.to/embed/movie/872585'")
        print("  python vidsrc_to_m3u8.py 'https://vidsrc.to/embed/tv/94605/1/1' my_playlist.m3u8")
        sys.exit(1)
    
    embed_url = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'playlist.m3u8'
    
    extractor = VidSrcExtractor()
    
    # Parse the URL
    content_type, tmdb_id, season, episode = extractor.parse_vidsrc_url(embed_url)
    
    print("="*60)
    if content_type == 'movie':
        print(f"[*] Content Type: Movie (TMDB ID: {tmdb_id})")
    elif content_type == 'tv':
        print(f"[*] Content Type: TV Show (TMDB ID: {tmdb_id}, S{season}E{episode})")
    print("="*60)
    
    # Extract M3U8 URLs
    m3u8_urls = extractor.extract_from_embed(embed_url)
    
    if m3u8_urls:
        print("\n" + "="*60)
        print("[+] SUCCESS - Extracted M3U8 URLs:")
        print("="*60)
        for i, url in enumerate(m3u8_urls, 1):
            print(f"\n{i}. {url}")
        
        # Save to file
        extractor.save_to_m3u8_file(m3u8_urls, output_file)
        
        print(f"\n[+] You can play the playlist with:")
        print(f"    mpv {output_file}")
        print(f"    vlc {output_file}")
        print(f"    ffplay {output_file}")
    else:
        print("\n[!] Automatic extraction failed - see manual instructions above")


if __name__ == '__main__':
    main()
