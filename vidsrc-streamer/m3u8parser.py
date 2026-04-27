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
):
    try:
        # Note: Stremio OpenSubtitles v3 addon requires exact IMDb ID with 'tt'
        if not imdb_id.startswith('tt'):
            imdb_id = 'tt' + imdb_id
            
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
            
        # Get the first English subtitle
        best_subtitle = next((sub for sub in subtitles if sub.get('lang') == 'eng' or sub.get('lang') == 'English'), None)
        
        if not best_subtitle:
            raise HTTPException(status_code=404, detail="English subtitle not found")
            
        download_link = best_subtitle.get("url")
        
        if not download_link:
            raise HTTPException(status_code=404, detail="Subtitle download link not found")
            
        # 2. Download the actual subtitle file (.srt/.vtt)
        sub_res = requests.get(download_link)
        if sub_res.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to download subtitle file")
            
        # Stremio returns raw text, no need to decompress!
        raw_text = sub_res.text
            
        return {"text": raw_text}

    except Exception as ex:
        logging.error(f"Error fetching subtitles for {imdb_id}: {ex}")
        raise HTTPException(status_code=500, detail="Error fetching subtitles")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("m3u8parser:app", host="0.0.0.0", port=8000, reload=True)
