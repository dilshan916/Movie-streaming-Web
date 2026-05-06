from fastapi import FastAPI, HTTPException, Response, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Optional
from helper.vidsrc_extractor import VidSrcExtractor
from helper.vidsrc_browser import VidSrcBrowserExtractor
from helper.local_subs import LocalSubtitleScraper
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import requests
import time
import sqlite3
import gzip
import io
import hashlib
import threading
from collections import OrderedDict
from urllib.parse import urlparse, parse_qs, urljoin, unquote
import re as re_mod

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
def get_stream_content(
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
def get_subtitle(
    imdb_id: str,
    title: Optional[str] = None,
    s: Optional[int] = None,
    e: Optional[int] = None,
    lang: str = "eng",
):
    try:
        # If requesting Sinhala subtitles, attempt to scrape local Sri Lankan sites first!
        if lang in ["sin", "Sinhala", "Sinhalese"] and title:
            try:
                local_scraper = LocalSubtitleScraper()
                raw_text = local_scraper.search_all(title, s, e)
                if raw_text:
                    return {"text": raw_text, "lang": lang}
            except Exception as ex:
                logging.error(f"Local scraper failed for {title}: {ex}")

        # Fallback to Stremio OpenSubtitles v3 addon
        # Note: Stremio OpenSubtitles v3 addon requires exact IMDb ID with 'tt'
        if not imdb_id.startswith('tt'):
            imdb_id = 'tt' + imdb_id
            
        # Build Stremio OpenSubtitles v3 addon URL
        if s and e:
            url = f"https://opensubtitles-v3.strem.io/subtitles/series/{imdb_id}:{s}:{e}.json"
        else:
            url = f"https://opensubtitles-v3.strem.io/subtitles/movie/{imdb_id}.json"

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
def search_subtitle(
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

# ──────────────────────────────────────────────────────────────────────
# Segment Cache – In-memory LRU with TTL for HLS .ts / .m4s segments
# ──────────────────────────────────────────────────────────────────────
SEGMENT_CACHE_MAX = 200          # max cached segments (each ~0.5-2 MB)
SEGMENT_CACHE_TTL = 600          # 10 minutes TTL per entry
_segment_cache: OrderedDict = OrderedDict()   # key -> (content, content_type, timestamp)
_segment_cache_lock = threading.Lock()
_prefetch_in_progress: set = set()  # URLs currently being prefetched

def _cache_key(url: str) -> str:
    """Short deterministic key for a URL."""
    return hashlib.md5(url.encode()).hexdigest()

def _cache_get(url: str):
    """Get from cache if present and not expired."""
    key = _cache_key(url)
    with _segment_cache_lock:
        entry = _segment_cache.get(key)
        if entry is None:
            return None
        content, ctype, ts = entry
        if time.time() - ts > SEGMENT_CACHE_TTL:
            _segment_cache.pop(key, None)
            return None
        # Move to end (most recently used)
        _segment_cache.move_to_end(key)
        return (content, ctype)

def _cache_put(url: str, content: bytes, content_type: str):
    """Store in cache, evicting oldest if over limit."""
    key = _cache_key(url)
    with _segment_cache_lock:
        _segment_cache[key] = (content, content_type, time.time())
        _segment_cache.move_to_end(key)
        while len(_segment_cache) > SEGMENT_CACHE_MAX:
            _segment_cache.popitem(last=False)

def _fetch_upstream(url: str, timeout: int = 30):
    """Fetch a URL from upstream CDN using curl_cffi for Cloudflare bypass."""
    from curl_cffi import requests as cffi_requests
    
    fetch_url = url
    
    # If it's a storm.vodvidl.site proxy URL, bypass Cloudflare
    parsed = urlparse(url)
    if "storm.vodvidl.site" in parsed.netloc and "/proxy/" in parsed.path:
        qs = parse_qs(parsed.query)
        real_host = qs.get("host", [None])[0]
        if real_host:
            real_host = unquote(real_host).rstrip("/")
            real_path = parsed.path.replace("/proxy/", "/", 1)
            fetch_url = f"{real_host}{real_path}"
            logging.info(f"[Proxy] Bypassing CF: {url[:50]}... -> {fetch_url[:50]}...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://videostr.net/",
        "Origin": "https://videostr.net",
    }
    
    res = cffi_requests.get(fetch_url, headers=headers, timeout=timeout, impersonate="chrome120")
    return res.content, res.headers.get("Content-Type", "application/octet-stream")


def _prefetch_segments(segment_urls: list):
    """Background thread: prefetch a list of segment URLs into cache."""
    for seg_url in segment_urls:
        if _cache_get(seg_url) is not None:
            continue  # Already cached
        if seg_url in _prefetch_in_progress:
            continue  # Another thread is fetching this
        try:
            _prefetch_in_progress.add(seg_url)
            logging.info(f"[Prefetch] Fetching: {seg_url[-60:]}")
            content, ctype = _fetch_upstream(seg_url, timeout=20)
            _cache_put(seg_url, content, ctype)
            logging.info(f"[Prefetch] Cached: {len(content)} bytes")
        except Exception as ex:
            logging.warning(f"[Prefetch] Failed: {seg_url[-40:]} - {ex}")
        finally:
            _prefetch_in_progress.discard(seg_url)


def _extract_segment_urls_from_m3u8(m3u8_text: str, base_url: str) -> list:
    """Parse an M3U8 manifest and return all segment URLs (absolute)."""
    segments = []
    for line in m3u8_text.split("\n"):
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            segments.append(urljoin(base_url, stripped))
    return segments


@app.get("/proxy")
def proxy_url(url: str):
    """Proxy any URL to bypass CORS restrictions for HLS.js playback.
    Features:
    - In-memory segment cache (LRU, 200 entries, 10min TTL)
    - Background prefetching of next segments when manifest is loaded
    - Cloudflare bypass via curl_cffi for storm.vodvidl.site URLs
    - M3U8 URL rewriting for absolute paths
    """
    try:
        # ── Check cache first (segments only) ──
        is_m3u8 = (
            ".m3u8" in url or
            "mpegurl" in url.lower()
        )
        
        if not is_m3u8:
            cached = _cache_get(url)
            if cached:
                content, content_type = cached
                logging.info(f"[Proxy] CACHE HIT: {url[-50:]} ({len(content)} bytes)")
                return Response(
                    content=content,
                    media_type=content_type,
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Headers": "*",
                        "X-Cache": "HIT",
                    }
                )
        
        # ── Fetch from upstream ──
        content, content_type = _fetch_upstream(url)
        
        logging.info(f"[Proxy] Upstream: {url[-50:]} | {len(content)} bytes | {content_type}")
        
        # ── Detect M3U8 from content ──
        if not is_m3u8 and content[:7] == b"#EXTM3U":
            is_m3u8 = True
        
        if is_m3u8:
            text = content.decode("utf-8", errors="replace")
            text = text.replace("\r\n", "\n").replace("\r", "\n")
            
            # Extract segment URLs BEFORE rewriting (for prefetch)
            segment_urls = _extract_segment_urls_from_m3u8(text, url)
            
            # Rewrite URLs to absolute
            lines = text.split("\n")
            rewritten = []
            for line in lines:
                stripped = line.strip()
                if stripped and not stripped.startswith("#"):
                    absolute_url = urljoin(url, stripped)
                    rewritten.append(absolute_url)
                else:
                    def replace_uri(match):
                        quote = match.group(1)
                        uri = match.group(2)
                        abs_uri = urljoin(url, uri)
                        return f'URI={quote}{abs_uri}{quote}'
                    
                    new_line = re_mod.sub(r'URI=(["\'])([^"\']+)\1', replace_uri, stripped)
                    rewritten.append(new_line)
            
            content = "\n".join(rewritten).encode("utf-8")
            content_type = "application/vnd.apple.mpegurl"
            
            # ── Background prefetch the first N segments ──
            # Only prefetch actual segment URLs (not variant playlist URLs which are also .m3u8)
            ts_segments = [u for u in segment_urls if not u.endswith(".m3u8")]
            if ts_segments:
                # Prefetch first 5 segments immediately for instant playback start
                prefetch_batch = ts_segments[:5]
                t = threading.Thread(target=_prefetch_segments, args=(prefetch_batch,), daemon=True)
                t.start()
                logging.info(f"[Proxy] Kicked off prefetch for {len(prefetch_batch)} segments")
            
            preview = "\n".join(rewritten[:3])
            logging.info(f"[Proxy] Rewrote M3U8 ({len(lines)} lines). Segments: {len(ts_segments)}")
        else:
            # Cache non-M3U8 responses (segments)
            _cache_put(url, content, content_type)
        
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "X-Cache": "MISS",
            }
        )
    except Exception as ex:
        logging.error(f"Proxy error for {url}: {ex}")
        raise HTTPException(status_code=502, detail="Proxy fetch failed")


@app.get("/proxy/cache-stats")
def proxy_cache_stats():
    """Debug endpoint: check segment cache status."""
    with _segment_cache_lock:
        total_bytes = sum(len(entry[0]) for entry in _segment_cache.values())
        return {
            "cached_segments": len(_segment_cache),
            "max_segments": SEGMENT_CACHE_MAX,
            "total_cached_mb": round(total_bytes / 1024 / 1024, 2),
            "prefetch_in_progress": len(_prefetch_in_progress),
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("m3u8parser:app", host="0.0.0.0", port=8000, reload=True)
