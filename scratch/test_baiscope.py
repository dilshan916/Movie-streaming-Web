import requests
from bs4 import BeautifulSoup
import re
import zipfile
import io

def search_baiscope(query):
    url = f"https://www.baiscopelk.com/?s={requests.utils.quote(query)}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        res = requests.get(url, headers=headers)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # Baiscope uses article tags for posts
        articles = soup.find_all('article')
        results = []
        for article in articles[:5]:
            title_tag = article.find('h2', class_='entry-title') or article.find('h3')
            if not title_tag:
                continue
            a_tag = title_tag.find('a')
            if not a_tag:
                continue
                
            title = a_tag.text.strip()
            link = a_tag['href']
            results.append({'title': title, 'link': link})
            
        return results
    except Exception as e:
        print(f"Error: {e}")
        return []

def get_download_link(post_url):
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        res = requests.get(post_url, headers=headers)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # Find download button (usually has class 'download-button' or text 'Download')
        links = soup.find_all('a')
        for link in links:
            href = link.get('href', '')
            if '.zip' in href.lower() or 'download' in link.text.lower():
                # Let's print potential links
                print(f"Found potential link: {href} ({link.text.strip()})")
    except Exception as e:
        print(f"Error: {e}")

print(search_baiscope("My Demon"))
