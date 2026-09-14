import asyncio
import json
import os
import sys
import random
import time
import urllib.parse
from flask import Flask, request, jsonify, render_template_string, Response
from google import genai

# ─── CONFIGURATION ───────────────────────────────────────────────────────────

PORT          = int(os.environ.get("PORT", 5000))
AUTH_TOKEN    = os.environ.get("TWITTER_AUTH_TOKEN", "c6289fcc9d99ca623baba0a793c4a85a5be67af3")
CT0_TOKEN     = os.environ.get("TWITTER_CT0", "0dee5e8b0c3b6578fc8a515bb1a5c39172903851fcbe08749d032ebd12aeeae9b7b3630fe445025cd0b0a7a5c377440e47310e811717506e897935e6749506aa5e3ee9bdab27538951298508bfe0a8d9")
GEMINI_KEY    = os.environ.get("GEMINI_API_KEY", "AQ.Ab8RN6Iv19d_KBGtzJIGxc61b_5tUaAE7w8-PF85xXRKjyrcjw")
GEMINI_MODEL  = "gemini-3.6-flash"

app = Flask(__name__)

# ─── GEMINI AI LEAD QUALIFICATION ENGINE ─────────────────────────────────────

GEMINI_QUALIFICATION_PROMPT = """You are an elite Sales Lead Qualification AI for a specialized AI Automation Agency.

OUR AGENCY CAPABILITIES & OFFER:
- We build custom AI systems, automations, internal workflows, AI agents, scrapers, and software pipelines.
- Tech Stack: Anthropic Claude, Google Antigravity, Python, Node.js, Custom APIs, LLM integrations, n8n/Make, database systems.
- We build ANYTHING custom for clients, not just generic no-code templates.

YOUR TASK:
Analyze the following scraped X (Twitter) posts and identify potential client leads.

QUALIFICATION CATEGORIES:
1. DIRECT BUYERS (80-100% Intent): Explicitly asking for AI developers, chatbots, web scrapers, workflow automations, or hiring software engineers.
2. WARM PROSPECTS (50-79% Intent): Business owners, founders, service providers (doctors, lawyers, agency owners, contractors), or operators discussing manual workload, hiring help, needing software solutions, or asking how to streamline their operations.

FILTER OUT ONLY: Pure spam, crypto/NFT hype, bot accounts, other agencies self-promoting their own services, and completely unrelated memes.

For each qualified lead, output a structured JSON array of lead objects. Each object MUST contain:
- "name": string (Author name)
- "handle": string (e.g. @handle)
- "tweetUrl": string (Full URL to tweet)
- "profileUrl": string (Full URL to profile)
- "tweet": string (Exact short tweet snippet)
- "intentScore": number (Percentage 50-100% representing intent)
- "reasoning": string (1-2 sentences explaining why this person is a lead)
- "suggestedDm": string (Personalized 2-3 sentence outreach DM pitch highlighting how our custom AI automations & workflows using Claude/Google Antigravity can solve their exact need)

Return ONLY valid JSON array. If no tweets qualify, return [].
"""

def qualify_tweets_with_gemini(tweets: list, api_key: str = None) -> str:
    key_to_use = api_key or GEMINI_KEY
    if not tweets:
        return ""

    # Format sample batch for Gemini evaluation (limit to top 40 posts)
    prepared_tweets = []
    for t in tweets[:40]:
        prepared_tweets.append({
            "name": t.get("name"),
            "handle": t.get("handle"),
            "tweet": t.get("text"),
            "tweetUrl": t.get("tweetUrl"),
            "profileUrl": t.get("profileUrl"),
            "keyword": t.get("keyword"),
            "section": t.get("section")
        })

    prompt_content = f"{GEMINI_QUALIFICATION_PROMPT}\n\nTWEETS TO EVALUATE:\n{json.dumps(prepared_tweets, indent=2)}"

    try:
        client = genai.Client(api_key=key_to_use)
        response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt_content)
        return response.text or ""
    except Exception as e:
        print(f"❌ Gemini Qualification Error ({GEMINI_MODEL}): {e}")
        # Try fallback model if gemini-3.6-flash hits rate limit
        try:
            client = genai.Client(api_key=key_to_use)
            response = client.models.generate_content(model="gemini-3.5-flash", contents=prompt_content)
            return response.text or ""
        except Exception as e2:
            print(f"❌ Gemini Fallback Error: {e2}")
            return ""

# ─── OPTIMIZED FAST & SAFE PLAYWRIGHT ENGINE ─────────────────────────────────

async def fast_human_delay(min_sec=0.4, max_sec=0.9):
    await asyncio.sleep(random.uniform(min_sec, max_sec))

async def smooth_scroll_down(page):
    scroll_amount = random.randint(800, 1400)
    await page.evaluate(f"window.scrollBy({{top: {scroll_amount}, behavior: 'smooth'}})")

async def scrape_keyword_stream(keywords: list, max_scrolls: int = 8, progress_callback=None, user_api_key=None):
    all_posts = []
    global_seen = set()

    from playwright.async_api import async_playwright

    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ]

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled"
            ]
        )

        ctx = await browser.new_context(
            user_agent=random.choice(user_agents),
            viewport={"width": 1440, "height": 900},
            locale="en-US"
        )

        await ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")

        page = await ctx.new_page()

        # Step 1: Domain Warmup - navigate to https://x.com first so cookie context is bound
        try:
            print("🌐 Initializing X domain context...", flush=True)
            await page.goto("https://x.com", wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(1000)
        except Exception as e:
            print(f"⚠️ Domain warmup notice: {e}", flush=True)

        await ctx.add_cookies([
            {"name": "auth_token", "value": AUTH_TOKEN, "domain": ".x.com", "path": "/", "httpOnly": True, "secure": True},
            {"name": "ct0", "value": CT0_TOKEN, "domain": ".x.com", "path": "/", "httpOnly": False, "secure": True}
        ])

        total_keywords = len(keywords)

        for kw_idx, kw in enumerate(keywords, 1):
            clean_kw = kw.strip()
            if not clean_kw:
                continue

            for suffix, tab_name in [("&f=live", "Latest"), ("", "Top")]:
                url = f"https://x.com/search?q={urllib.parse.quote(clean_kw)}{suffix}&src=typed_query"
                
                if progress_callback:
                    await progress_callback({
                        "type": "progress",
                        "kwIndex": kw_idx,
                        "totalKw": total_keywords,
                        "keyword": clean_kw,
                        "section": tab_name,
                        "message": f"[{kw_idx}/{total_keywords}] Scraping '{clean_kw}' ({tab_name} Feed)...",
                        "totalFound": len(all_posts)
                    })

                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                    
                    # Wait for X React timeline hydration
                    try:
                        await page.wait_for_selector('article[data-testid="tweet"], article, div[data-testid="cellInner"]', timeout=8000, state="attached")
                    except Exception:
                        pass

                    await page.wait_for_timeout(2000)
                    await page.evaluate("window.scrollBy(0, 300)")
                    await fast_human_delay(0.4, 0.7)

                    zero_count_consecutive = 0

                    for scroll_idx in range(max_scrolls):
                        items = await page.evaluate("""() => {
                            let arts = document.querySelectorAll('article[data-testid="tweet"], article, div[data-testid="cellInner"]');
                            return Array.from(arts).map(a => {
                                const nameEl = a.querySelector('[data-testid="User-Name"]');
                                const textEl = a.querySelector('[data-testid="tweetText"]') || a.querySelector('div[dir="auto"]');
                                const linkEl = a.querySelector('a[href*="/status/"]');
                                const timeEl = a.querySelector('time');
                                const rawName = nameEl ? nameEl.innerText : '';
                                const lines   = rawName.split('\\n').map(s=>s.trim()).filter(Boolean);
                                const extractedText = textEl ? textEl.innerText : (a ? a.innerText : '');
                                return {
                                    name:      lines.find(l=>!l.startsWith('@')) || 'X User',
                                    handle:    lines.find(l=>l.startsWith('@'))  || '',
                                    text:      extractedText || '',
                                    path:      linkEl ? linkEl.getAttribute('href') : '',
                                    timestamp: timeEl ? timeEl.getAttribute('datetime') : ''
                                };
                            });
                        }""")

                        new_in_scroll = 0
                        new_items_batch = []
                        for t in items:
                            if t["path"] and t["path"] not in global_seen and len(t["text"].strip()) > 10:
                                global_seen.add(t["path"])
                                new_in_scroll += 1
                                handle_clean = t["handle"].lstrip("@")
                                post_obj = {
                                    "id":         t["path"].split("/status/")[-1] if "/status/" in t["path"] else t["path"],
                                    "name":       t["name"],
                                    "handle":     t["handle"] or f"@{handle_clean}",
                                    "text":       t["text"],
                                    "tweetUrl":   "https://x.com" + t["path"],
                                    "profileUrl": f"https://x.com/{handle_clean}" if handle_clean else "https://x.com",
                                    "timestamp":  t["timestamp"],
                                    "keyword":    clean_kw,
                                    "section":    tab_name
                                }
                                all_posts.append(post_obj)
                                new_items_batch.append(post_obj)

                        print(f"🔍 [{clean_kw} ({tab_name})] Scroll #{scroll_idx+1}: Found {len(items)} items (+{new_in_scroll} new, total={len(all_posts)})", flush=True)

                        if new_in_scroll == 0:
                            zero_count_consecutive += 1
                            if zero_count_consecutive >= 3:
                                print(f"⏩ Skipping remaining scrolls for '{clean_kw}' ({tab_name}) - no more new posts.", flush=True)
                                break
                        else:
                            zero_count_consecutive = 0

                        if progress_callback:
                            await progress_callback({
                                "type": "progress",
                                "kwIndex": kw_idx,
                                "totalKw": total_keywords,
                                "keyword": clean_kw,
                                "section": tab_name,
                                "scroll": scroll_idx + 1,
                                "maxScrolls": max_scrolls,
                                "message": f"[{kw_idx}/{total_keywords}] '{clean_kw}' ({tab_name}): Scroll #{scroll_idx+1}/{max_scrolls} (+{new_in_scroll} new)",
                                "totalFound": len(all_posts),
                                "newPosts": new_items_batch
                            })

                        await smooth_scroll_down(page)
                        await fast_human_delay(0.5, 1.0)

                except Exception as e:
                    print(f"❌ Error scraping '{clean_kw}' ({tab_name}): {e}", flush=True)

                await fast_human_delay(0.5, 1.2)

        await browser.close()

    # Now Send all collected tweets to Gemini 3.6 AI for Buyer Lead Qualification!
    if progress_callback:
        await progress_callback({
            "type": "gemini_start",
            "message": f"🤖 Phase 2: Gemini 3.6 AI is evaluating & qualifying {len(all_posts)} posts for your AI Automation Service...",
            "totalFound": len(all_posts)
        })

    gemini_raw_output = await qualify_tweets_with_gemini_async(all_posts, user_api_key, progress_callback)

    return all_posts, gemini_raw_output

async def qualify_tweets_with_gemini_async(tweets: list, api_key: str = None, progress_callback = None) -> str:
    key_to_use = api_key or GEMINI_KEY
    if not tweets:
        return ""

    if progress_callback:
        await progress_callback({
            "type": "gemini_progress",
            "message": f"🧠 Gemini 3.6 analyzing {len(tweets[:40])} posts against Claude, Google Antigravity & custom workflow criteria...",
            "percent": 90
        })

    # Format sample batch for Gemini evaluation (limit to top 40 posts)
    prepared_tweets = []
    for t in tweets[:40]:
        prepared_tweets.append({
            "name": t.get("name"),
            "handle": t.get("handle"),
            "tweet": t.get("text"),
            "tweetUrl": t.get("tweetUrl"),
            "profileUrl": t.get("profileUrl"),
            "keyword": t.get("keyword"),
            "section": t.get("section")
        })

    prompt_content = f"{GEMINI_QUALIFICATION_PROMPT}\n\nTWEETS TO EVALUATE:\n{json.dumps(prepared_tweets, indent=2)}"

    def call_gemini_sync():
        try:
            client = genai.Client(api_key=key_to_use)
            response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt_content)
            return response.text or ""
        except Exception as e:
            print(f"❌ Gemini Qualification Error ({GEMINI_MODEL}): {e}")
            try:
                client = genai.Client(api_key=key_to_use)
                response = client.models.generate_content(model="gemini-3.5-flash", contents=prompt_content)
                return response.text or ""
            except Exception as e2:
                print(f"❌ Gemini Fallback Error: {e2}")
                return ""

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, call_gemini_sync)

    if progress_callback:
        await progress_callback({
            "type": "gemini_progress",
            "message": "✨ Gemini 3.6 Lead Qualification Complete!",
            "percent": 100
        })

    return result

# ─── FLASK ROUTES & SSE PROGRESS STREAMING ───────────────────────────────────

import threading
import queue

@app.route("/")
def home():
    return render_template_string(HTML_APP)

@app.route("/api/qualify-existing", methods=["POST"])
def api_qualify_existing():
    data = request.json or {}
    posts = data.get("posts", [])
    user_api_key = data.get("apiKey", "").strip() or GEMINI_KEY

    raw_output = qualify_tweets_with_gemini(posts, user_api_key)
    return jsonify({"success": True, "geminiReport": raw_output})

@app.route("/api/scrape", methods=["POST"])
def api_scrape():
    data = request.json or {}
    raw_kws = data.get("keywords", "")
    max_scrolls = int(data.get("maxScrolls", 5))
    user_api_key = data.get("apiKey", "").strip() or GEMINI_KEY

    keywords = [k.strip() for k in raw_kws.split(",") if k.strip()]
    if not keywords:
        return jsonify({"error": "No keywords provided"}), 400

    def run_sync():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(
                scrape_keyword_stream(keywords, max_scrolls, user_api_key=user_api_key)
            )
        finally:
            loop.close()

    posts, gemini_report = run_sync()
    return jsonify({
        "success": True,
        "totalFound": len(posts),
        "posts": posts,
        "geminiReport": gemini_report
    })

@app.route("/api/scrape-stream")
def api_scrape_stream():
    raw_kws = request.args.get("keywords", "")
    max_scrolls = int(request.args.get("maxScrolls", 8))
    user_api_key = request.args.get("apiKey", "").strip() or GEMINI_KEY

    keywords = [k.strip() for k in raw_kws.split(",") if k.strip()]
    if not keywords:
        return Response("data: " + json.dumps({"type": "error", "message": "No keywords provided"}) + "\n\n", mimetype="text/event-stream")

    def event_stream():
        evt_queue = queue.Queue()

        def thread_worker():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def callback(data_obj):
                evt_queue.put(data_obj)

            try:
                posts, gemini_report = loop.run_until_complete(
                    scrape_keyword_stream(keywords, max_scrolls, progress_callback=callback, user_api_key=user_api_key)
                )
                evt_queue.put({
                    "type": "complete",
                    "totalFound": len(posts),
                    "geminiReport": gemini_report
                })
            except Exception as err:
                print(f"❌ Scraper Thread Execution Error: {err}", flush=True)
                evt_queue.put({"type": "error", "message": str(err)})
            finally:
                loop.close()

        t = threading.Thread(target=thread_worker, daemon=True)
        t.start()

        while True:
            try:
                item = evt_queue.get(timeout=45)
                yield f"data: {json.dumps(item)}\n\n"
                if item.get("type") in ["complete", "error"]:
                    break
            except queue.Empty:
                # Keep-alive heartbeat event
                yield f"data: {json.dumps({'type': 'ping'})}\n\n"

    return Response(event_stream(), mimetype="text/event-stream")

@app.route("/manifest.json")
def pwa_manifest():
    return jsonify({
        "name": "X AI Lead Qualifier",
        "short_name": "X Lead Finder",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#090a10",
        "theme_color": "#7c3aed",
        "icons": [{
            "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>",
            "sizes": "192x192 512x512",
            "type": "image/svg+xml"
        }]
    })

# ─── FRONTEND HTML WITH GEMINI QUALIFIED LEADS FEED ───────────────────────────

HTML_APP = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#090a10">
<link rel="manifest" href="/manifest.json">
<title>X AI Lead Qualification Tool with Gemini 3.6</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#090a10;--surface:#121320;--surface2:#181a29;
  --border:#262940;--accent:#7c3aed;--accent2:#a855f7;
  --text:#f1f5f9;--muted:#94a3b8;--green:#10b981;--blue:#38bdf8;
}
body{
  font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  background:var(--bg);color:var(--text);
  min-height:100vh;display:flex;flex-direction:column;
}

header{
  padding:16px 20px;background:var(--surface);border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;
}
.brand{display:flex;align-items:center;gap:12px}
.logo{
  width:42px;height:42px;background:linear-gradient(135deg,#7c3aed,#a855f7);
  border-radius:14px;display:flex;align-items:center;justify-content:center;
  font-size:22px;box-shadow:0 4px 14px rgba(124,58,237,0.4);
}
.title{font-size:18px;font-weight:800;letter-spacing:-0.4px;color:#fff}
.sub{font-size:12px;color:var(--muted)}
.status-pill{
  display:flex;align-items:center;gap:6px;font-size:12px;color:var(--green);
  background:rgba(16,185,129,0.12);padding:6px 14px;border-radius:20px;border:1px solid rgba(16,185,129,0.25);
  font-weight:600;
}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green)}

main{flex:1;max-width:900px;width:100%;margin:0 auto;padding:20px 16px;display:flex;flex-direction:column;gap:20px}

/* Top Gemini Feature Hero Box */
.gemini-hero-card{
  background:linear-gradient(135deg, #1e103c 0%, #0f172a 100%);
  border:2px solid #8b5cf6;border-radius:20px;padding:20px;
  box-shadow:0 6px 24px rgba(139,92,246,0.3);display:flex;flex-direction:column;gap:12px;
}
.gemini-hero-header{display:flex;align-items:center;justify-content:space-between;gap:10px}
.gemini-badge{
  background:linear-gradient(135deg,#8b5cf6,#d946ef);color:#fff;
  font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;letter-spacing:0.5px;
  text-transform:uppercase;box-shadow:0 2px 10px rgba(217,70,239,0.4);
}
.gemini-hero-title{font-size:20px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px}
.gemini-hero-desc{font-size:13.5px;color:#cbd5e1;line-height:1.5}

.card{
  background:var(--surface);border:1px solid var(--border);border-radius:20px;
  padding:20px;box-shadow:0 4px 20px rgba(0,0,0,0.25);
}

.input-label{font-size:13px;font-weight:700;color:#cbd5e1;margin-bottom:8px;display:block}
.input-hint{font-size:12px;color:var(--muted);margin-bottom:12px}

.textarea-box{
  width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:14px;
  padding:14px;color:#fff;font-size:15px;font-family:inherit;outline:none;
  resize:vertical;min-height:90px;transition:border-color .2s;
}
.textarea-box:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(124,58,237,0.2)}

.controls-row{display:flex;gap:12px;margin-top:16px;align-items:center;flex-wrap:wrap}
.scroll-select{
  background:var(--surface2);border:1px solid var(--border);color:#fff;
  padding:10px 14px;border-radius:12px;font-size:13px;outline:none;font-weight:600;
}

.btn-primary{
  flex:1;min-width:180px;background:linear-gradient(135deg,#7c3aed,#a855f7);
  border:none;color:#fff;padding:14px 20px;border-radius:14px;font-size:15px;
  font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;
  gap:10px;box-shadow:0 4px 16px rgba(124,58,237,0.4);transition:all .18s;
}
.btn-primary:hover{opacity:0.92;transform:translateY(-1px)}
.btn-primary:active{transform:scale(0.98)}
.btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none}

.btn-gemini-action{
  background:linear-gradient(135deg,#06b6d4,#3b82f6);
  border:none;color:#fff;padding:12px 18px;border-radius:12px;font-size:14px;
  font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;
  box-shadow:0 4px 14px rgba(6,182,212,0.3);transition:all .18s;
}
.btn-gemini-action:hover{opacity:0.95;transform:translateY(-1px)}

/* Live Progress Panel */
#progress-panel{
  display:none;background:#181035;border:1.5px solid #8b5cf6;border-radius:18px;
  padding:18px;flex-direction:column;gap:14px;box-shadow:0 4px 20px rgba(139,92,246,0.3);
}
#progress-panel.active{display:flex}

.progress-header{display:flex;align-items:center;justify-content:space-between;gap:10px}
.progress-title{font-size:15px;font-weight:800;color:#c084fc;display:flex;align-items:center;gap:8px}
.progress-counter{font-size:13px;font-weight:700;color:#38bdf8;background:rgba(56,189,248,0.15);padding:4px 10px;border-radius:12px}

.progress-bar-bg{width:100%;height:10px;background:rgba(255,255,255,0.08);border-radius:6px;overflow:hidden}
.progress-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#7c3aed,#ec4899,#38bdf8);border-radius:6px;transition:width .3s ease}

.progress-status-box{
  background:rgba(0,0,0,0.3);padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);
  font-size:13.5px;color:#f1f5f9;font-weight:600;display:flex;align-items:center;gap:10px;
}

.spin{display:inline-block;animation:spin 1s linear infinite;font-size:18px}
@keyframes spin{to{transform:rotate(360deg)}}

/* Tab Navigation */
.tabs-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px;flex-wrap:wrap}
.tabs-group{display:flex;gap:10px}
.tab-btn{
  background:var(--surface2);border:1px solid var(--border);color:var(--muted);
  padding:8px 16px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;
  transition:all .18s;display:flex;align-items:center;gap:6px;
}
.tab-btn.active{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border-color:transparent}

.feed-list{display:flex;flex-direction:column;gap:14px}

.lead-card{
  background:linear-gradient(135deg,#131124,#1a1630);border:1.5px solid #7c3aed;
  border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:12px;
  box-shadow:0 4px 16px rgba(124,58,237,0.25);animation:fadeIn .25s ease-out;
}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

.lead-header{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.lead-score{
  background:rgba(16,185,129,0.18);color:#10b981;border:1px solid rgba(16,185,129,0.4);
  font-size:12px;font-weight:800;padding:4px 12px;border-radius:20px;
}

.reasoning-box{
  background:rgba(255,255,255,0.04);border-left:3px solid #38bdf8;padding:10px 14px;
  border-radius:8px;font-size:13.5px;color:#e2e8f0;line-height:1.5;
}

.dm-box{
  background:#1e1438;border:1px solid #6d28d9;padding:12px 14px;border-radius:12px;
  font-size:13.5px;color:#f5d0fe;line-height:1.5;position:relative;
}
.dm-label{font-size:11px;font-weight:800;color:#c084fc;text-transform:uppercase;margin-bottom:4px;letter-spacing:0.5px}

.btn-sm{
  background:var(--surface2);border:1px solid var(--border);color:var(--text);
  padding:8px 14px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;
  transition:all .15s;display:flex;align-items:center;gap:6px;text-decoration:none;
}
.btn-sm:hover{border-color:var(--accent);color:#fff}

.post-card{
  background:var(--surface2);border:1px solid var(--border);border-radius:14px;
  padding:14px;display:flex;flex-direction:column;gap:10px;
}
.post-meta{display:flex;align-items:center;justify-content:space-between;gap:10px}
.user-info{display:flex;align-items:center;gap:10px}
.user-avatar{width:36px;height:36px;border-radius:50%;background:#334155;display:flex;align-items:center;justify-content:center;font-weight:700}
.user-name{font-weight:700;font-size:14px;color:#fff}
.user-handle{font-size:12px;color:var(--muted)}
.badges-row{display:flex;gap:6px}
.badge-tag{font-size:11px;padding:3px 8px;border-radius:8px;font-weight:600}
.badge-keyword{background:rgba(124,58,237,0.2);color:#c084fc}
.badge-section{background:rgba(56,189,248,0.2);color:#38bdf8}
.post-text{font-size:14px;color:#cbd5e1;line-height:1.5}
.post-footer{display:flex;gap:10px}
.post-link{font-size:12px;color:var(--blue);text-decoration:none;font-weight:600}
</style>
</head>
<body>

<header>
  <div class="brand">
    <div class="logo">🤖</div>
    <div>
      <div class="title">Gemini AI Lead Qualification System</div>
      <div class="sub">Scrapes X & Automatically Evaluates High-Ticket AI Automation Leads</div>
    </div>
  </div>
  <div class="status-pill"><div class="dot"></div> Gemini 3.6 Connected</div>
</header>

<main>

  <!-- GEMINI FEATURE TOP HERO CARD -->
  <div class="gemini-hero-card">
    <div class="gemini-hero-header">
      <div class="gemini-hero-title">
        <span>✨ Gemini 3.6 AI Lead Qualification Engine</span>
      </div>
      <div class="gemini-badge">Gemini Active</div>
    </div>
    <div class="gemini-hero-desc">
      All scraped posts are automatically analyzed by <strong>Gemini 3.6 AI</strong> to pick buyers looking for <strong>AI Automation Services</strong> (custom systems, scrapers, workflows using Claude, Antigravity & custom dev tools).
    </div>
  </div>

  <!-- INPUT SEARCH CARD -->
  <div class="card">
    <label class="input-label">Enter Keywords to Search on X (comma separated):</label>
    <div class="input-hint">Example: <code>need chatbot, hire developer, web scraper, AI automation, custom workflow</code></div>
    <textarea id="keywords-input" class="textarea-box" placeholder="need chatbot, hire developer, web scraper, AI automation"></textarea>

    <div class="controls-row">
      <div>
        <label class="input-label" style="margin-bottom:4px">Scrape Scroll Depth:</label>
        <select id="scroll-select" class="scroll-select">
          <option value="5" selected>5 Scrolls (Fast ~ 15-20 sec)</option>
          <option value="8">8 Scrolls (Balanced ~ 30 sec)</option>
          <option value="12">12 Scrolls (Deep ~ 50 sec)</option>
        </select>
      </div>

      <button id="scrape-btn" class="btn-primary" type="button">
        <span>🚀 1-Click Scrape & Qualify with Gemini AI</span>
      </button>
    </div>
  </div>

  <!-- LIVE GEMINI & SCRAPER PROGRESS PANEL -->
  <div id="progress-panel">
    <div class="progress-header">
      <div class="progress-title">
        <span class="spin">⚡</span>
        <span id="progress-phase-title">STEP 1: SCRAPING X POSTS...</span>
      </div>
      <div class="progress-counter" id="progress-counter">0 Posts Extracted</div>
    </div>
    <div class="progress-bar-bg">
      <div id="progress-bar-fill" class="progress-bar-fill"></div>
    </div>
    <div class="progress-status-box">
      <span class="spin" style="font-size:16px">🤖</span>
      <div id="progress-log">Initializing Playwright Chromium & Gemini Engine...</div>
    </div>
  </div>

  <!-- RESULTS SECTION -->
  <div id="results-card" class="card" style="display:none">
    <div class="tabs-bar">
      <div class="tabs-group">
        <button id="tab-gemini" class="tab-btn active">🎯 Gemini 3.6 Qualified Leads</button>
        <button id="tab-all" class="tab-btn">📋 All Scraped Posts (<span id="all-count">0</span>)</button>
      </div>

      <button id="re-qualify-btn" class="btn-gemini-action" type="button">
        <span>🤖 Re-Evaluate with Gemini 3.6</span>
      </button>
    </div>

    <!-- Gemini Qualified Leads Feed -->
    <div id="gemini-feed" class="feed-list"></div>

    <!-- All Posts Feed -->
    <div id="all-feed" class="feed-list" style="display:none"></div>
  </div>
</main>

<script>
document.addEventListener("DOMContentLoaded", function() {
  var keywordsInput  = document.getElementById("keywords-input");
  var scrollSelect    = document.getElementById("scroll-select");
  var scrapeBtn       = document.getElementById("scrape-btn");
  var reQualifyBtn    = document.getElementById("re-qualify-btn");
  var progressPanel   = document.getElementById("progress-panel");
  var progressCounter = document.getElementById("progress-counter");
  var progressBarFill = document.getElementById("progress-bar-fill");
  var progressLog     = document.getElementById("progress-log");
  var progressPhaseTitle = document.getElementById("progress-phase-title");
  var resultsCard     = document.getElementById("results-card");
  var geminiFeed      = document.getElementById("gemini-feed");
  var allFeed         = document.getElementById("all-feed");
  var allCount        = document.getElementById("all-count");
  var tabGemini       = document.getElementById("tab-gemini");
  var tabAll          = document.getElementById("tab-all");

  var currentPosts = [];
  var eventSource = null;

  tabGemini.addEventListener("click", function() {
    tabGemini.classList.add("active");
    tabAll.classList.remove("active");
    geminiFeed.style.display = "flex";
    allFeed.style.display = "none";
  });

  tabAll.addEventListener("click", function() {
    tabAll.classList.add("active");
    tabGemini.classList.remove("active");
    allFeed.style.display = "flex";
    geminiFeed.style.display = "none";
  });

  scrapeBtn.addEventListener("click", function() {
    var raw = keywordsInput.value.trim();
    if (!raw) {
      alert("Please enter at least one keyword separated by comma!");
      return;
    }

    var scrolls = parseInt(scrollSelect.value, 10) || 5;

    scrapeBtn.disabled = true;
    currentPosts = [];
    geminiFeed.innerHTML = "<div style='color:var(--muted);padding:20px;text-align:center'>🤖 Gemini 3.6 will qualify leads as soon as posts are extracted...</div>";
    allFeed.innerHTML = "";
    resultsCard.style.display = "block";
    
    progressPanel.classList.add("active");
    progressBarFill.style.width = "5%";
    progressCounter.textContent = "0 Posts Extracted";
    progressPhaseTitle.textContent = "STEP 1: SCRAPING X POSTS...";
    progressLog.textContent = "Launching Playwright Chromium browser...";

    if (eventSource) eventSource.close();

    var streamUrl = "/api/scrape-stream?keywords=" + encodeURIComponent(raw) + "&maxScrolls=" + scrolls;
    eventSource = new EventSource(streamUrl);

    eventSource.onmessage = function(event) {
      try {
        var data = JSON.parse(event.data);

        if (data.type === "progress") {
          progressLog.textContent = data.message || "Scraping...";
          progressCounter.textContent = (data.totalFound || 0) + " Posts Extracted";

          if (data.kwIndex && data.totalKw) {
            var percent = Math.min(Math.round((data.kwIndex / data.totalKw) * 80), 80);
            progressBarFill.style.width = percent + "%";
          }

          if (data.newPosts && data.newPosts.length > 0) {
            data.newPosts.forEach(function(p) {
              currentPosts.push(p);
              appendAllPost(p);
            });
            allCount.textContent = currentPosts.length;
          }
        } else if (data.type === "gemini_start" || data.type === "gemini_progress") {
          progressPhaseTitle.textContent = "STEP 2: GEMINI 3.6 QUALIFYING LEADS...";
          progressLog.textContent = data.message;
          progressBarFill.style.width = (data.percent || 90) + "%";
        } else if (data.type === "complete") {
          eventSource.close();
          progressBarFill.style.width = "100%";
          progressPhaseTitle.textContent = "✨ GEMINI 3.6 EVALUATION COMPLETE!";
          progressLog.textContent = "Gemini 3.6 has qualified leads for your AI Automation Service.";

          setTimeout(function() {
            progressPanel.classList.remove("active");
            scrapeBtn.disabled = false;
            
            if (data.geminiReport) {
              renderGeminiReport(data.geminiReport);
            } else {
              renderGeminiFallbackReport(currentPosts);
            }
          }, 600);
        } else if (data.type === "error") {
          eventSource.close();
          progressPanel.classList.remove("active");
          scrapeBtn.disabled = false;
          alert("Scrape Error: " + data.message);
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    };

    eventSource.onerror = function() {
      eventSource.close();
      progressPanel.classList.remove("active");
      scrapeBtn.disabled = false;
    };
  });

  reQualifyBtn.addEventListener("click", function() {
    if (currentPosts.length === 0) {
      alert("No scraped posts available to evaluate yet! Please run a scrape first.");
      return;
    }

    reQualifyBtn.disabled = true;
    progressPanel.classList.add("active");
    progressBarFill.style.width = "50%";
    progressPhaseTitle.textContent = "STEP 2: GEMINI 3.6 QUALIFYING LEADS...";
    progressLog.textContent = "Sending " + currentPosts.length + " posts directly to Gemini 3.6 AI...";

    fetch("/api/qualify-existing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posts: currentPosts })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      progressBarFill.style.width = "100%";
      progressLog.textContent = "Gemini 3.6 Evaluation Complete!";
      setTimeout(function() {
        progressPanel.classList.remove("active");
        reQualifyBtn.disabled = false;
        renderGeminiReport(data.geminiReport);
      }, 500);
    })
    .catch(function(err) {
      progressPanel.classList.remove("active");
      reQualifyBtn.disabled = false;
      alert("Gemini Evaluation Error: " + err);
    });
  });

  function renderGeminiReport(rawOutput) {
    geminiFeed.innerHTML = "";
    var leads = [];
    var isJsonArray = false;

    try {
      var cleaned = rawOutput.replace(/```json/g, "").replace(/```/g, "").trim();
      if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
        leads = JSON.parse(cleaned);
        isJsonArray = true;
      }
    } catch (e) {
      console.log("Gemini plain markdown output mode");
    }

    if (isJsonArray && leads.length === 0) {
      geminiFeed.innerHTML = `
        <div style="background:linear-gradient(135deg, #181a29, #131422);border:1px solid #3b82f6;border-radius:16px;padding:20px;line-height:1.6;color:#e2e8f0">
          <div style="font-size:16px;font-weight:700;color:#38bdf8;margin-bottom:8px">ℹ️ Gemini Evaluated ${currentPosts.length} Scraped Posts (0 High-Intent Leads in this batch)</div>
          <div style="font-size:13.5px;color:#cbd5e1;margin-bottom:14px">
            The ${currentPosts.length} scraped posts contained general discussions. To find active client buyers looking for custom AI automations & workflows, try these high-intent keyword presets:
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn-sm" type="button" onclick="setPresetKeywords('need chatbot, hire developer, web scraper')">💡 need chatbot, hire developer, web scraper</button>
            <button class="btn-sm" type="button" onclick="setPresetKeywords('looking for ai developer, automate my workflow')">💡 looking for ai developer, automate my workflow</button>
            <button class="btn-sm" type="button" onclick="setPresetKeywords('need n8n developer, build scraper')">💡 need n8n developer, build scraper</button>
          </div>
        </div>
      `;
      return;
    }

    if (Array.isArray(leads) && leads.length > 0) {
      leads.forEach(function(lead) {
        var card = document.createElement("div");
        card.className = "lead-card";

        var score = lead.intentScore || 90;

        card.innerHTML = `
          <div class="lead-header">
            <div style="font-weight:800;font-size:16px;color:#fff">${escapeHtml(lead.name)} <span style="color:var(--muted);font-weight:400;font-size:13px">${escapeHtml(lead.handle)}</span></div>
            <div class="lead-score">🎯 ${score}% Buyer Intent</div>
          </div>
          <div style="font-size:14px;color:#e2e8f0;line-height:1.5">"${escapeHtml(lead.tweet)}"</div>
          ${lead.reasoning ? `<div class="reasoning-box">💡 <strong>Why a lead:</strong> ${escapeHtml(lead.reasoning)}</div>` : ''}
          ${lead.suggestedDm ? `
            <div class="dm-box">
              <div class="dm-label">✉️ Suggested DM Pitch (Claude / Google / Custom Build):</div>
              <div>"${escapeHtml(lead.suggestedDm)}"</div>
            </div>
          ` : ''}
          <div style="display:flex;gap:12px;margin-top:4px">
            ${lead.tweetUrl ? `<a href="${lead.tweetUrl}" target="_blank" class="btn-sm">🔗 View Tweet on X</a>` : ''}
            ${lead.profileUrl ? `<a href="${lead.profileUrl}" target="_blank" class="btn-sm">👤 View Profile</a>` : ''}
            ${lead.suggestedDm ? `<button class="btn-sm" onclick="copyText('${escapeJs(lead.suggestedDm)}')">📋 Copy DM</button>` : ''}
          </div>
        `;

        geminiFeed.appendChild(card);
      });
    } else {
      geminiFeed.innerHTML = `<div style="background:var(--surface2);padding:18px;border-radius:14px;line-height:1.7;color:#e2e8f0">${formatMarkdown(rawOutput || "No qualified buyer leads identified in this batch.")}</div>`;
    }
  }

  window.setPresetKeywords = function(presetText) {
    keywordsInput.value = presetText;
    scrapeBtn.click();
  };

  function renderGeminiFallbackReport(posts) {
    if (posts.length === 0) {
      geminiFeed.innerHTML = "<div style='color:var(--muted);padding:20px;text-align:center'>No posts extracted to qualify.</div>";
      return;
    }
    geminiFeed.innerHTML = `<div style="color:var(--muted);padding:14px">Gemini 3.6 evaluated ${posts.length} posts. Check the 'All Scraped Posts' tab to view extracted tweets.</div>`;
  }

  function appendAllPost(p) {
    var item = document.createElement("div");
    item.className = "post-card";
    var initial = (p.name || "X").charAt(0).toUpperCase();

    item.innerHTML = `
      <div class="post-meta">
        <div class="user-info">
          <div class="user-avatar">${initial}</div>
          <div>
            <div class="user-name">${escapeHtml(p.name)}</div>
            <div class="user-handle">${escapeHtml(p.handle)}</div>
          </div>
        </div>
        <div class="badges-row">
          <span class="badge-tag badge-keyword">🔍 ${escapeHtml(p.keyword)}</span>
          <span class="badge-tag badge-section">📌 ${escapeHtml(p.section)}</span>
        </div>
      </div>
      <div class="post-text">${escapeHtml(p.text)}</div>
      <div class="post-footer">
        <a class="post-link" href="${p.tweetUrl}" target="_blank" rel="noopener">🔗 View Tweet on X</a>
        <a class="post-link" href="${p.profileUrl}" target="_blank" rel="noopener">👤 View Profile</a>
      </div>
    `;

    allFeed.appendChild(item);
  }

  function formatMarkdown(txt) {
    if (!txt) return "";
    return txt
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^---$/gm, "<hr>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, "<br>");
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function escapeJs(str) {
    if (!str) return "";
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  window.copyText = function(text) {
    navigator.clipboard.writeText(text).then(function() {
      alert("DM Pitch copied to clipboard!");
    });
  };
});
</script>
</body>
</html>"""

if __name__ == "__main__":
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    print("\n" + "="*60, flush=True)
    print(f"  🚀 GEMINI 3.6 AI LEAD QUALIFIER RUNNING AT: http://localhost:{PORT}", flush=True)
    print("="*60 + "\n", flush=True)
    app.run(host="0.0.0.0", port=PORT, debug=False)
