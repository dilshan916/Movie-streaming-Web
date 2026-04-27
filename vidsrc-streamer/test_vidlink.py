from curl_cffi import requests

def test_vidlink():
    url = "https://vidlink.pro/tv/218539/1/1"
    response = requests.get(url, impersonate="chrome120")
    print(response.status_code)
    
    # Check if m3u8 or stream url is in the HTML
    text = response.text
    if "m3u8" in text:
        print("M3U8 found in HTML!")
    else:
        print("M3U8 not found directly.")
        
    # Write to file to analyze
    with open("vidlink_test.html", "w", encoding="utf-8") as f:
        f.write(text)

test_vidlink()
