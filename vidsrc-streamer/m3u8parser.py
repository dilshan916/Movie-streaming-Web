from fastapi import FastAPI, HTTPException, Response, Depends
from typing import Optional
from helper.vidsrc_extractor import VidSrcExtractor
from helper.vidsrc_browser import VidSrcBrowserExtractor
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import requests
import time
import sqlite3
import gzip
import io

app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)

# Add CORS middleware
origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_vidsrc_extractor() -> VidSrcBrowserExtractor:
    return VidSrcBrowserExtractor(headless=True)

# SQLite database initialization
DATABASE_FILE = "stream_cache.db"

def initialize_database():
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    # Create table with timestamp
    cursor.execute('''CREATE TABLE IF NOT EXISTS stream_cache_v2 (
                      imdb_id TEXT PRIMARY KEY,
                      stream_url TEXT,
                      created_at INTEGER
                   )''')
    conn.commit()
    conn.close()

initialize_database()

def insert_stream(imdb_id, stream_url):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    current_time = int(time.time())
    cursor.execute('''INSERT OR REPLACE INTO stream_cache_v2 (
                      imdb_id, stream_url, created_at)
                      VALUES (?, ?, ?)''',
                   (imdb_id, stream_url, current_time))
    conn.commit()
    conn.close()

def get_stream_from_database(imdb_id):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute('''SELECT stream_url, created_at FROM stream_cache_v2
                      WHERE imdb_id=?''',
                   (imdb_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        stream_url, created_at = row
        # Check if cache is older than 2 hours (7200 seconds)
        if int(time.time()) - created_at < 7200:
            return stream_url
        else:
            # Cache expired, delete it
            delete_stream_from_database(imdb_id)
            return None
    return None

def delete_stream_from_database(imdb_id):
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute('''DELETE FROM stream_cache_v2 WHERE imdb_id=?''', (imdb_id,))
    conn.commit()
    conn.close()


@app.get("/stream/{imdb_id}")
async def get_stream_content(
    imdb_id: str,
    type: str = "movie",
    s: Optional[int] = None,
    e: Optional[int] = None,
    vse: VidSrcExtractor = Depends(get_vidsrc_extractor),
):
    cache_key = f"{imdb_id}_{type}_{s}_{e}"
    cached_stream = get_stream_from_database(cache_key)
    if cached_stream:
        return {"url": cached_stream}

    try:
        # Use VidLink for direct browser scraping (headless=True is fine since no anti-debug)
        if type == "movie":
            embed_url = f"https://vidlink.pro/movie/{imdb_id}?autoplay=true"
        else:
            embed_url = f"https://vidlink.pro/tv/{imdb_id}/{s}/{e}?autoplay=true"
            
        urls = vse.extract_from_embed(embed_url, wait_time=8)
        stream_url = urls[0] if urls else None

        if not stream_url:
            logging.warning(f"Stream not found for {cache_key}")
            raise HTTPException(status_code=404, detail="Stream not found")

        insert_stream(cache_key, stream_url)
        return {"url": stream_url}

    except requests.RequestException as e:
        logging.error(f"Error fetching stream content for IMDb ID {imdb_id}: {e}")
        raise HTTPException(status_code=500, detail="Error fetching stream content")
    except Exception as e:
        logging.error(f"Unexpected error for IMDb ID {imdb_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/subtitle/{imdb_id}")
async def get_subtitle(
    imdb_id: str,
    s: Optional[int] = None,
    e: Optional[int] = None,
    lang: str = "eng",
):
    try:
        # Note: Stremio OpenSubtitles v3 addon requires exact IMDb ID with 'tt'
        if not imdb_id.startswith('tt'):
            imdb_id = 'tt' + imdb_id
            
        # Build Stremio OpenSubtitles v3 addon URL with language configuration
        if s and e:
            url = f"https://opensubtitles-v3.strem.io/sublanguageid-{lang}/subtitles/series/{imdb_id}:{s}:{e}.json"
        else:
            url = f"https://opensubtitles-v3.strem.io/sublanguageid-{lang}/subtitles/movie/{imdb_id}.json"

        # 1. Fetch subtitle metadata from Stremio addon
        response = requests.get(url)
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Subtitles not found")
            
        data = response.json()
        subtitles = data.get('subtitles', [])
        
        if not subtitles:
            raise HTTPException(status_code=404, detail="Subtitles not found")
        
        # Language mapping for flexible matching
        LANG_ALIASES = {
            "eng": ["eng", "English"],
            "sin": ["sin", "Sinhala", "Sinhalese"],
            "jpn": ["jpn", "Japanese"],
            "kor": ["kor", "Korean"],
            "spa": ["spa", "Spanish"],
        }
        
        aliases = LANG_ALIASES.get(lang, [lang])
        best_subtitle = next((sub for sub in subtitles if sub.get('lang') in aliases), None)
        
        if not best_subtitle:
            # Fallback to the first subtitle returned if language isn't explicitly matched
            best_subtitle = subtitles[0]
            
        download_link = best_subtitle.get("url")
        
        if not download_link:
            raise HTTPException(status_code=404, detail="Subtitle download link not found")
            
        # 2. Download the actual subtitle file (.srt/.vtt)
        sub_res = requests.get(download_link)
        if sub_res.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to download subtitle file")
            
        # Stremio returns raw text, no need to decompress!
        raw_text = sub_res.text
            
        return {"text": raw_text, "lang": lang}

    except HTTPException:
        raise
    except Exception as ex:
        logging.error(f"Error fetching subtitles for {imdb_id} ({lang}): {ex}")
        raise HTTPException(status_code=500, detail="Error fetching subtitles")

@app.get("/subtitle/search")
async def search_subtitle(
    query: str,
    lang: str = "eng",
    season: Optional[int] = None,
    episode: Optional[int] = None,
):
    """Search subtitles by movie/show name using OpenSubtitles REST API"""
    try:
        # Build OpenSubtitles REST API URL
        search_query = query.replace(" ", "+")
        base_url = f"https://rest.opensubtitles.org/search/query-{search_query}/sublanguageid-{lang}"
        
        if season and episode:
            base_url += f"/season-{season}/episode-{episode}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-User-Agent': 'trailers.to-UA',
        }
        
        response = requests.get(base_url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="No subtitles found")
        
        results = response.json()
        if not results:
            raise HTTPException(status_code=404, detail="No subtitles found for this query")
        
        # Get the highest scoring subtitle
        best = max(results, key=lambda x: float(x.get('Score', 0)), default=None)
        if not best:
            raise HTTPException(status_code=404, detail="No subtitles found")
        
        download_link = best.get("SubDownloadLink")
        if not download_link:
            raise HTTPException(status_code=404, detail="Subtitle download link not found")
        
        # Download and decompress (OpenSubtitles REST returns gzip)
        sub_res = requests.get(download_link)
        if sub_res.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to download subtitle")
        
        # Try to decompress gzip, fallback to raw text
        try:
            raw_text = gzip.decompress(sub_res.content).decode('utf-8', errors='replace')
        except:
            raw_text = sub_res.text
        
        return {
            "text": raw_text,
            "lang": lang,
            "title": best.get("MovieName", query),
        }

    except HTTPException:
        raise
    except Exception as ex:
        logging.error(f"Error searching subtitles for '{query}' ({lang}): {ex}")
        raise HTTPException(status_code=500, detail="Error searching subtitles")

@app.get("/proxy")
async def proxy_url(url: str):
    """Proxy any URL to bypass CORS restrictions for HLS.js playback.
    For storm.vodvidl.site URLs, bypasses Cloudflare by going directly to the real CDN.
    For M3U8 files, rewrites relative URLs to absolute so HLS.js can resolve them."""
    try:
        from curl_cffi import requests as cffi_requests
        from urllib.parse import urlparse, parse_qs, urljoin, unquote
        import re as re_mod
        
        fetch_url = url
        
        # If it's a storm.vodvidl.site proxy URL, bypass Cloudflare by going directly to real CDN
        parsed = urlparse(url)
        if "storm.vodvidl.site" in parsed.netloc and "/proxy/" in parsed.path:
            qs = parse_qs(parsed.query)
            real_host = qs.get("host", [None])[0]
            if real_host:
                real_host = unquote(real_host).rstrip("/")
                # Remove '/proxy/' prefix from path
                real_path = parsed.path.replace("/proxy/", "/", 1)
                # Build headers from URL params
                fetch_url = f"{real_host}{real_path}"
                logging.info(f"[Proxy] Bypassing Cloudflare: {url[:60]}... -> {fetch_url[:60]}...")
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://videostr.net/",
            "Origin": "https://videostr.net",
        }
        
        res = cffi_requests.get(fetch_url, headers=headers, timeout=30, impersonate="chrome120")
        
        content_type = res.headers.get("Content-Type", "application/octet-stream")
        content = res.content
        
        logging.info(f"[Proxy] Upstream response: {res.status_code}, Type: {content_type}, Size: {len(content)}")
        
        # If it's an M3U8 playlist, rewrite relative URLs to absolute
        is_m3u8 = (
            ".m3u8" in url or 
            "mpegurl" in content_type.lower() or
            content[:7] == b"#EXTM3U"
        )
        
        if is_m3u8:
            text = content.decode("utf-8", errors="replace")
            
            # Normalize line endings
            text = text.replace("\r\n", "\n").replace("\r", "\n")
            lines = text.split("\n")
            rewritten = []
            for line in lines:
                stripped = line.strip()
                # Non-empty lines that don't start with # are URLs
                if stripped and not stripped.startswith("#"):
                    absolute_url = urljoin(url, stripped)
                    rewritten.append(absolute_url)
                else:
                    # Also rewrite URI="..." attributes inside #EXT-X-MAP, #EXT-X-KEY etc.
                    def replace_uri(match):
                        quote = match.group(1)
                        uri = match.group(2)
                        abs_uri = urljoin(url, uri)
                        return f'URI={quote}{abs_uri}{quote}'
                    
                    new_line = re_mod.sub(r'URI=(["\'])([^"\']+)\1', replace_uri, stripped)
                    rewritten.append(new_line)
            
            content = "\n".join(rewritten).encode("utf-8")
            content_type = "application/vnd.apple.mpegurl"
            preview = "\n".join(rewritten[:5])
            logging.info(f"[Proxy] Rewrote {len(lines)} lines. First 5:\n{preview}")
        
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
    except Exception as ex:
        logging.error(f"Proxy error for {url}: {ex}")
        raise HTTPException(status_code=502, detail="Proxy fetch failed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("m3u8parser:app", host="0.0.0.0", port=8000, reload=True)
