import urllib.request
import urllib.parse
import re
import ssl
from html import unescape
from concurrent.futures import ThreadPoolExecutor, as_completed

def _fetch_url(url: str, timeout: float = 3.5, data: bytes = None) -> str:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+413' # Bypass Google consent redirection wall
    }
    if data is not None:
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        
    req = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method="POST" if data is not None else "GET"
    )
    try:
        # Create unverified SSL context to bypass certificate issues on local Windows environments
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context, timeout=timeout) as response:
            return response.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"[Search Service Worker] Error fetching {url}: {e}")
        return ""

def _search_ddg_lite(query: str):
    """Scrapes DuckDuckGo Lite (stable, text-only) using POST request"""
    url = "https://lite.duckduckgo.com/lite/"
    post_data = urllib.parse.urlencode({"q": query}).encode("utf-8")
    html = _fetch_url(url, timeout=3.5, data=post_data)
    if not html:
        return []
    
    # Robustly find all <a> tags containing result-link class
    a_tags = re.findall(r"(<a[^>]*>.*?</a>)", html, re.DOTALL)
    links = []
    for tag in a_tags:
        if "result-link" in tag:
            href_match = re.search(r'href=["\']([^"\']+)["\']', tag)
            title_match = re.search(r'>([^<]+)</a>', tag, re.DOTALL) or re.search(r'>(.*?)</a>', tag, re.DOTALL)
            if href_match and title_match:
                links.append((href_match.group(1), title_match.group(1).strip()))

    # Robustly find all <td> tags containing result-snippet class
    tds = re.findall(r"(<td[^>]*class=['\"]result-snippet['\"][^>]*>.*?</td>)", html, re.DOTALL)
    snippets = []
    for td in tds:
        clean_text = re.sub(r'<[^>]+>', '', td).strip()
        snippets.append(clean_text)
        
    results = []
    for i in range(min(len(links), len(snippets))):
        link_url, title = links[i]
        snippet = snippets[i]
        
        title = re.sub(r'<[^>]+>', '', title).strip()
        snippet = re.sub(r'<[^>]+>', '', snippet).strip()
        
        if "uddg=" in link_url:
            parts = link_url.split("uddg=")
            if len(parts) > 1:
                link_url = urllib.parse.unquote(parts[1].split("&")[0])
                
        results.append({
            "title": unescape(title),
            "snippet": unescape(snippet),
            "link": link_url
        })
        if len(results) >= 4:
            break
    return results

def _search_google(query: str):
    """Scrapes basic Google search layout by splitting results by H3 tags"""
    query_encoded = urllib.parse.quote(query)
    url = f"https://www.google.com/search?q={query_encoded}&gbv=1&hl=en"
    html = _fetch_url(url, timeout=3.5)
    if not html:
        return []
    
    results = []
    blocks = html.split('<h3')
    
    for block in blocks[1:]:
        title_end = block.find('</h3>')
        if title_end == -1:
            continue
            
        title_raw = block[:title_end]
        title = re.sub(r'<[^>]+>', '', title_raw).strip()
        
        link_match = re.search(r'href="/url\?q=([^&"]+)[^"]*"', block)
        if not link_match:
            link_match = re.search(r'/url\?q=([^&"]+)', block)
            
        if link_match:
            link = urllib.parse.unquote(link_match.group(1))
            if "google.com" in link or "webcache.googleusercontent.com" in link:
                continue
                
            snippets = re.findall(r'<div class="BNeawe[^"]*">(.*?)</div>', block, re.DOTALL)
            snippet = ""
            for s in snippets:
                clean_s = re.sub(r'<[^>]+>', '', s).strip()
                if len(clean_s) > len(snippet):
                    if title.lower() not in clean_s.lower():
                        snippet = clean_s
            
            if not snippet:
                snippet = re.sub(r'<[^>]+>', ' ', block[title_end:])
                snippet = re.sub(r'\s+', ' ', snippet).strip()
                
            if title and not any(r['title'] == title for r in results):
                results.append({
                    "title": unescape(title),
                    "snippet": unescape(snippet[:200].strip()),
                    "link": link
                })
                if len(results) >= 4:
                    break
    return results

def _search_duckduckgo(query: str):
    """Scrapes standard DDG HTML fallback using POST request"""
    url = "https://html.duckduckgo.com/html/"
    post_data = urllib.parse.urlencode({"q": query}).encode("utf-8")
    html = _fetch_url(url, timeout=3.5, data=post_data)
    if not html:
        return []
    
    # Robustly find all divs containing result__body class
    divs = re.findall(r"(<div[^>]*class=['\"][^'\"]*result__body[^'\"]*['\"][^>]*>.*?</div>\s*</div>)", html, re.DOTALL)
    if not divs:
        # Fallback split
        divs = html.split('class="links_main links_deep result__body"')
        divs = divs[1:]
        
    results = []
    for div in divs:
        title_match = re.search(r"<a[^>]*class=['\"]result__a['\"][^>]*>(.*?)</a>", div, re.DOTALL)
        snippet_match = re.search(r"<a[^>]*class=['\"]result__snippet['\"][^>]*>(.*?)</a>", div, re.DOTALL)
        link_match = re.search(r"<a[^>]*class=['\"]result__a['\"][^>]*href=['\"]([^'\"]+)['\"]", div, re.DOTALL)
        
        if title_match and snippet_match:
            title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip()
            snippet = re.sub(r'<[^>]+>', '', snippet_match.group(1)).strip()
            link = link_match.group(1) if link_match else ""
            
            if "uddg=" in link:
                parts = link.split("uddg=")
                if len(parts) > 1:
                    link = urllib.parse.unquote(parts[1].split("&")[0])
                    
            results.append({
                "title": unescape(title),
                "snippet": unescape(snippet),
                "link": link
            })
            if len(results) >= 4:
                break
    return results

def search_web(query: str):
    print(f"[Search Service] Parallel web search started for: '{query}'")
    results = []
    
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(_search_ddg_lite, query): "DuckDuckGo Lite",
            executor.submit(_search_google, query): "Google",
            executor.submit(_search_duckduckgo, query): "DuckDuckGo HTML"
        }
        
        for future in as_completed(futures):
            source = futures[future]
            try:
                res = future.result()
                if res:
                    print(f"[Search Service] {source} returned {len(res)} results.")
                    results.extend(res)
            except Exception as e:
                print(f"[Search Service] {source} worker raised exception: {e}")
                
    # Deduplicate results by title key
    seen = set()
    unique_results = []
    for r in results:
        title_key = r['title'].lower().strip()
        if title_key not in seen:
            seen.add(title_key)
            unique_results.append(r)
            
    print(f"[Search Service] Parallel search completed. Returning {len(unique_results[:4])} unique results.")
    return unique_results[:4]
