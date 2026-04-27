# VidSrc to M3U8 Extractor

Extract M3U8 streaming URLs from VidSrc using multiple methods.

## 🚀 Three Methods Available

### Method 1: Enhanced HTTP Scraper (vidsrc_to_m3u8_v2.py)
Best for: Quick attempts, debugging, understanding the structure
- Analyzes HTML and JavaScript
- Attempts API endpoint discovery
- Shows detailed diagnostic information
- **Pros**: Fast, no browser needed
- **Cons**: May fail due to JavaScript obfuscation

### Method 2: Browser Automation (vidsrc_browser.py) ⭐ RECOMMENDED
Best for: Actual extraction from live sites
- Uses real Chrome browser with Selenium
- Captures network traffic
- Executes JavaScript like a real user
- **Pros**: Most reliable, sees actual requests
- **Cons**: Requires Chrome/Chromedriver

### Method 3: Manual Browser DevTools
Best for: When automation fails or for learning
- Open embed URL in browser
- Use F12 DevTools Network tab
- Copy M3U8 URL directly
- **Pros**: Always works, educational
- **Cons**: Manual process

## 📦 Installation

```bash
# Install dependencies
pip install -r requirements.txt

# For browser method, also install Chrome and chromedriver
# Ubuntu/Debian:
sudo apt-get install chromium-browser chromium-chromedriver

# macOS:
brew install --cask google-chrome
brew install chromedriver

# Or use webdriver-manager (included in requirements.txt)
```

## 🎯 Usage

### Method 1: Enhanced Scraper

```bash
# Basic usage
python vidsrc_to_m3u8_v2.py 'https://vidsrc.to/embed/movie/872585'

# Custom output file
python vidsrc_to_m3u8_v2.py 'https://vidsrc.to/embed/tv/94605/1/1' my_show.m3u8
```

**This will:**
- Search for direct M3U8 URLs
- Extract VidSrc data structures
- Try API endpoints
- Decode base64 data
- Show detailed diagnostics

### Method 2: Browser Automation (RECOMMENDED) ⭐

```bash
# Basic usage (headless mode)
python vidsrc_browser.py 'https://vidsrc.to/embed/movie/872585'

# Show browser window (helpful for debugging)
python vidsrc_browser.py 'https://vidsrc.to/embed/movie/872585' --show-browser

# Increase wait time (if video loads slowly)
python vidsrc_browser.py 'https://vidsrc.to/embed/movie/872585' --wait 30

# Custom output file
python vidsrc_browser.py 'https://vidsrc.to/embed/tv/94605/1/1' --output my_show.m3u8

# All options combined
python vidsrc_browser.py 'https://vidsrc.to/embed/movie/872585' \
  --output movie.m3u8 \
  --wait 20 \
  --show-browser
```

**Options:**
- `--output FILE` - Output filename (default: playlist.m3u8)
- `--wait SECONDS` - Wait time for video to load (default: 15)
- `--show-browser` - Show browser window instead of headless mode

### Method 3: Manual DevTools

1. Open the VidSrc embed URL in Chrome/Firefox
2. Press **F12** to open DevTools
3. Click the **Network** tab
4. Filter by: `m3u8`
5. Play the video
6. Right-click the `.m3u8` request → **Copy** → **Copy URL**
7. Use the URL directly:
   ```bash
   mpv "https://example.com/stream/master.m3u8"
   ```

## 📺 Playing the Streams

Once you have the M3U8 file or URL:

```bash
# Using MPV (recommended)
mpv playlist.m3u8
mpv "https://direct-m3u8-url.com/master.m3u8"

# Using VLC
vlc playlist.m3u8

# Using FFplay
ffplay playlist.m3u8

# Download with ffmpeg
ffmpeg -i playlist.m3u8 -c copy output.mp4
```

## 🔍 Troubleshooting

### "No M3U8 URLs found"

**Try Method 2 (Browser):**
```bash
python vidsrc_browser.py 'YOUR_URL' --show-browser --wait 30
```

**If still failing:**
1. Open the URL manually in browser
2. Check if video actually plays
3. Use DevTools method to capture the URL

### "Chromedriver not found"

```bash
# Install webdriver-manager (already in requirements.txt)
pip install webdriver-manager

# Or install chromedriver manually
# Ubuntu:
sudo apt-get install chromium-chromedriver

# macOS:
brew install chromedriver
```

### "Player doesn't load"

- Increase wait time: `--wait 30` or `--wait 60`
- Use `--show-browser` to see what's happening
- Some VidSrc embeds may not work due to region restrictions

### Video URL expires quickly

M3U8 URLs often have tokens that expire. If the URL doesn't work:
1. Re-run the extractor to get a fresh URL
2. Play/download immediately after extraction

## 📋 Example Workflows

### Extract and play immediately:
```bash
python vidsrc_browser.py 'https://vidsrc.to/embed/movie/872585' && mpv playlist.m3u8
```

### Extract and download:
```bash
python vidsrc_browser.py 'https://vidsrc.to/embed/movie/872585'
ffmpeg -i playlist.m3u8 -c copy movie.mp4
```

### Debug mode (see everything):
```bash
python vidsrc_browser.py 'https://vidsrc.to/embed/movie/872585' --show-browser --wait 30
```

## 🎬 Understanding VidSrc URLs

VidSrc uses TMDB IDs:

**Movies:**
```
https://vidsrc.to/embed/movie/{TMDB_ID}
Example: https://vidsrc.to/embed/movie/872585
```

**TV Shows:**
```
https://vidsrc.to/embed/tv/{TMDB_ID}/{SEASON}/{EPISODE}
Example: https://vidsrc.to/embed/tv/94605/1/1
```

You can find TMDB IDs on [TheMovieDB.org](https://www.themoviedb.org/)

## ⚠️ Important Notes

### Legal Disclaimer
This tool is for **educational purposes only**. Users are responsible for:
- Ensuring they have rights to access the content
- Complying with local laws and regulations
- Respecting copyright and intellectual property

### Technical Limitations
- M3U8 URLs may expire (typically 1-6 hours)
- Some content may be geo-restricted
- VidSrc may update their obfuscation methods
- Browser method requires Chrome/Chromium

### Privacy & Security
- The browser method executes JavaScript from VidSrc
- Network traffic is logged to capture M3U8 URLs
- Use at your own risk on trusted content only

## 🛠️ Advanced Usage

### Capture all network requests:
Modify `vidsrc_browser.py` to log all requests, not just M3U8:
```python
# In extract_m3u8_from_logs method, change the condition
if 'http' in url:  # Instead of: if '.m3u8' in url
    print(f"[+] Request: {url}")
```

### Custom headers:
Edit the `setup_driver` method in `vidsrc_browser.py` to add custom headers or cookies.

### Batch processing:
```bash
# Create a file with URLs (urls.txt)
# Then process each:
while read url; do
    python vidsrc_browser.py "$url" --output "$(echo $url | md5sum | cut -d' ' -f1).m3u8"
done < urls.txt
```

## 📚 Resources

- [VidSrc](https://vidsrc.to/) - The source site
- [TMDB](https://www.themoviedb.org/) - Find movie/show IDs
- [MPV Player](https://mpv.io/) - Best player for M3U8
- [FFmpeg](https://ffmpeg.org/) - For downloading/converting

## 📄 License

MIT License - Use at your own risk

---

**Questions or issues?** The browser method (`vidsrc_browser.py`) is your best bet for actual extraction. If that fails, fall back to manual DevTools method.
