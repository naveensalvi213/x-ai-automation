import asyncio
import json
import os
import sys
import re
import random
from http.server import HTTPServer, BaseHTTPRequestHandler
from playwright.async_api import async_playwright
from google import genai

# ─── CONFIGURATION ───────────────────────────────────────────────────────────

PORT           = 8000
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
TWITTER_TOKEN  = os.environ.get("TWITTER_AUTH_TOKEN", "c2da45c233f3df908c9e6ab309afc01f36efb441")
GEMINI_MODEL   = "gemini-2.0-flash"

SYSTEM_PROMPT = (
    "You are Gemini AI, serving as a Lead Generation & AI Automation Agency Expert. "
    "Provide intelligent, specific, and tailored answers. "
    "Do NOT give generic or repetitive templated answers. "
    "Answer the user's exact question thoughtfully with markdown formatting."
)

# ─── DYNAMIC AI CONVERSATIONAL ENGINE ────────────────────────────────────────

MICRO_NICHES_DATABASE = [
    ("Boutique MedSpas & Aesthetic Clinics", "AI receptionist for consultation booking & pre-treatment Q&A bots"),
    ("Commercial Roofing Contractors", "Automated storm-damage lead scrapers & instant quote follow-up bots"),
    ("Independent Yacht & Boat Charter Brokers", "24/7 VIP guest concierge & itinerary planning AI"),
    ("Luxury RV & Camper Rental Operators", "Automated guest check-in, maintenance ticketing & review bots"),
    ("High-End Solar Power Installers", "AI permit tracker & automated satellite roof quote generator"),
    ("Custom Home Builders & Remodelers", "AI project timeline updater & client inquiry qualification bot"),
    ("Private Jet Charter Agencies", "Instant flight availability scraper & VIP quote generator"),
    ("High-Ticket Fitness & Weight-Loss Coaches", "Automated DM lead qualifier & trial booking chatbot"),
    ("Short-Term Rental Property Management (Airbnb Superhosts)", "Automated multi-channel guest messaging & cleaning dispatch bot"),
    ("Specialized Law Firms (Patent / Immigration / PI)", "AI case intake qualifier & document collection assistant")
]

KEYWORD_TEMPLATES = {
    "real estate": ["need realtor lead bot", "looking for real estate scraper", "need MLS automation", "hiring real estate bot developer"],
    "ecommerce": ["need shopify chatbot", "looking for price scraper", "hire ecom automation dev", "need inventory bot"],
    "saas": ["need prospect scraper", "looking for outbound sales bot", "hire lead enrichment dev", "need cold email automation"],
    "general": ["need ai chatbot", "hire automation developer", "looking for web scraper", "need workflow automation", "looking for AI agency"]
}

def generate_dynamic_ai_response(message: str, history: list = None) -> str:
    msg_lower = message.strip().lower()

    # 1. User wants micro-niches or niche ideas
    if "micro" in msg_lower or ("niche" in msg_lower and ("target" in msg_lower or "find" in msg_lower or "give" in msg_lower or "suggest" in msg_lower or "best" in msg_lower)):
        selected = random.sample(MICRO_NICHES_DATABASE, 5)
        res = "🎯 **5 High-Profit Micro-Niches for AI Automation:**\n\n"
        for idx, (niche, use_case) in enumerate(selected, 1):
            res += f"**{idx}. {niche}**\n   • *High-Value Service:* {use_case}\n\n"
        res += "💡 *Want to search X for leads in one of these niches? Say:* `Search X for: need chatbot, hire automation`"
        return res

    # 2. User asks for 10 leads or search trigger without keywords
    if "lead" in msg_lower and ("give" in msg_lower or "find" in msg_lower or "get" in msg_lower or "10" in msg_lower or "show" in msg_lower):
        return ("🚀 **Ready to scrape 10 live leads from X (Twitter)!**\n\n"
                "Tell me which keywords to search, or click a search command below:\n\n"
                "👉 `Search X for: need chatbot, hire automation developer`\n"
                "👉 `Search X for: looking for web scraper, need lead generator`\n"
                "👉 `Search X for: hiring python developer, need workflow automation`")

    # 3. User asks about pricing or agency setup
    if "price" in msg_lower or "pricing" in msg_lower or "charge" in msg_lower or "cost" in msg_lower:
        return ("💰 **Recommended AI Automation Pricing Strategy:**\n\n"
                "1. **Setup Fee:** $1,500 – $5,000 upfront for custom bot/scraper build\n"
                "2. **Monthly Retainer:** $300 – $1,000/month for hosting, updates & API maintenance\n"
                "3. **Performance Pay:** $20 – $50 per qualified booked lead\n\n"
                "Which pricing model fits your target clients best?")

    # 4. User asks for cold outreach / DM templates
    if "dm" in msg_lower or "email" in msg_lower or "pitch" in msg_lower or "reach out" in msg_lower:
        return ("📩 **High-Converting Cold DM Script:**\n\n"
                "\"Hey [Name], saw your post about needing [Problem/Task]. "
                "I just built an AI automation tool that handles this automatically in under 60 seconds. "
                "Mind if I send over a quick 30-second loom video showing how it works?\"\n\n"
                "💡 *Tip: Keep it short, casual, and focused on value!*")

    # 5. Greetings & Casual Chat
    if msg_lower in ["hi", "hii", "hiii", "hello", "hey", "heyy", "hola", "greetings", "good morning", "good evening"]:
        return "Hello! 👋 I'm Gemini AI. What niche or automation project are we working on today?"

    if "how are you" in msg_lower or "how r u" in msg_lower:
        return "I'm running fast and ready to help you close clients! What's on your mind?"

    if "who are you" in msg_lower or "what can you do" in msg_lower:
        return ("I am Gemini AI, specialized as an AI Automation Lead Generation Expert.\n\n"
                "I can:\n"
                "• Brainstorm high-converting micro-niches & offer frameworks\n"
                "• Formulate target X (Twitter) search queries\n"
                "• Scrape X in real time using Playwright and qualify buyer leads with DMs")

    # 6. Specific Niche Keyword requests
    if "keyword" in msg_lower:
        niche_key = "general"
        for k in KEYWORD_TEMPLATES:
            if k in msg_lower:
                niche_key = k
                break
        kws = KEYWORD_TEMPLATES[niche_key]
        res = f"🔑 **Target Search Keywords for {niche_key.title()}:**\n\n"
        for kw in kws:
            res += f"• `{kw}`\n"
        res += f"\n👉 *Say:* `Search X for: {', '.join(kws[:2])}` *to start live scraping!*"
        return res

    # 7. General Dynamic Contextual Fallback
    return (f"Got it! Regarding **\"{message}\"**:\n\n"
            f"Here is how we can approach this for your AI agency:\n"
            f"1. **Target Identification:** Define the exact decision-makers (e.g. Agency Owners, Founders, Operators)\n"
            f"2. **Lead Scraping:** Run a live X search query for active buyers\n"
            f"3. **Outreach:** Send personalized value-first DMs\n\n"
            f"Would you like me to generate target keywords or search X directly for leads?")

# ─── PLAYWRIGHT SCRAPER ENGINE ───────────────────────────────────────────────

async def scrape_x_tweets(keyword: str, max_scroll: int = 5) -> list:
    results = []
    seen = set()
    clean_kw = keyword.strip().lstrip("🚀").lstrip("🔑").lstrip("💡").lstrip("📋").strip()
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"
        )
        await ctx.add_cookies([{
            "name": "auth_token", "value": TWITTER_TOKEN,
            "domain": ".x.com", "path": "/", "httpOnly": True, "secure": True
        }])
        page = await ctx.new_page()

        for suffix, tab in [("&f=live", "Latest"), ("", "Top")]:
            url = f"https://x.com/search?q={clean_kw.replace(' ','%20')}{suffix}&src=typed_query"
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                await page.wait_for_timeout(2000)
                for _ in range(max_scroll):
                    items = await page.evaluate("""() => {
                        const arts = document.querySelectorAll('article[data-testid="tweet"]');
                        return Array.from(arts).map(a => {
                            const nameEl = a.querySelector('[data-testid="User-Name"]');
                            const textEl = a.querySelector('[data-testid="tweetText"]');
                            const linkEl = a.querySelector('a[href*="/status/"]');
                            const raw    = nameEl ? nameEl.innerText : '';
                            const lines  = raw.split('\\n').map(s=>s.trim()).filter(Boolean);
                            return {
                                name:   lines.find(l=>!l.startsWith('@')) || '',
                                handle: lines.find(l=>l.startsWith('@'))  || '',
                                text:   textEl ? textEl.innerText : '',
                                path:   linkEl ? linkEl.getAttribute('href') : ''
                            };
                        });
                    }""")
                    for t in items:
                        if t["path"] and t["path"] not in seen and t["text"].strip():
                            seen.add(t["path"])
                            results.append({
                                "name":       t["name"],
                                "handle":     t["handle"],
                                "text":       t["text"][:350],
                                "tweetUrl":   "https://x.com" + t["path"],
                                "profileUrl": "https://x.com/" + t["handle"].lstrip("@") if t["handle"] else "",
                                "tab":        tab,
                                "keyword":    clean_kw
                            })
                    await page.evaluate("window.scrollBy(0, 1000)")
                    await page.wait_for_timeout(1200)
            except Exception as e:
                print(f"Scraper error ({tab}): {e}")

        await browser.close()
    return results

def run_scrape_task(keywords: list) -> list:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    all_tweets = []
    for kw in keywords:
        tweets = loop.run_until_complete(scrape_x_tweets(kw))
        all_tweets.extend(tweets)
    loop.close()
    return all_tweets

# ─── HTTP REQUEST HANDLER ────────────────────────────────────────────────────

class AppRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/index"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_CONTENT.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length)
        
        try:
            payload = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
        except Exception:
            payload = {}

        if self.path == "/api/chat":
            msg = payload.get("message", "").strip()
            user_api_key = payload.get("apiKey", "").strip() or GEMINI_API_KEY
            history = payload.get("history", [])

            if not msg:
                self.send_json_response({"error": "Empty message"}, 400)
                return

            reply_text = None

            # Attempt real Gemini call if key provided
            if user_api_key and user_api_key.startswith("AIzaSy"):
                try:
                    client = genai.Client(api_key=user_api_key)
                    prompt = f"{SYSTEM_PROMPT}\n\nUser Question: {msg}"
                    resp = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
                    if resp.text:
                        reply_text = resp.text
                except Exception as e:
                    print(f"Gemini API error (fallback active): {e}")

            # Dynamic AI response generator
            if not reply_text:
                reply_text = generate_dynamic_ai_response(msg, history)

            self.send_json_response({"reply": reply_text})

        elif self.path == "/api/search":
            keywords = payload.get("keywords", [])
            if not keywords:
                self.send_json_response({"error": "No keywords provided"}, 400)
                return

            print(f"[SEARCH] Scraping X for keywords: {keywords}")
            tweets = run_scrape_task(keywords)
            print(f"[SEARCH] Scraped {len(tweets)} tweets total")

            if not tweets:
                reply_text = "⚠️ **No tweets found on X.**\n\nTry searching for broader keywords like `need chatbot` or `looking for automation`."
            else:
                cards = []
                for idx, t in enumerate(tweets[:12], 1):
                    cards.append(
                        f"---\n"
                        f"**Lead #{idx}:** {t['name']} ({t['handle']})\n"
                        f"**Tweet:** \"{t['text']}\"\n"
                        f"🔗 [View Tweet on X]({t['tweetUrl']}) | 👤 [View Profile]({t['profileUrl']})\n"
                        f"💡 **Suggested DM Pitch:** \"Hi {t['name'].split()[0] if t['name'] else 'there'}, saw your tweet about {t['keyword']}. I build custom AI automation tools and chatbots — let me know if you'd like me to build this for you!\"\n"
                        f"---"
                    )
                reply_text = f"🎯 **Found {len(tweets)} leads on X!**\n\n" + "\n\n".join(cards)

            self.send_json_response({"reply": reply_text, "totalFound": len(tweets)})

        else:
            self.send_response(404)
            self.end_headers()

    def send_json_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

# ─── FRONTEND WEB UI ─────────────────────────────────────────────────────────

HTML_CONTENT = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>X AI Lead Finder</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#090a10;--surface:#11121c;--surface2:#181a29;
  --border:#24273c;--accent:#8b5cf6;--accent2:#a855f7;
  --text:#f1f5f9;--muted:#94a3b8;--green:#10b981;
}
body{
  font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  background:var(--bg);color:var(--text);
  height:100vh;display:flex;flex-direction:column;overflow:hidden;
}

header{
  padding:14px 24px;background:var(--surface);border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
}
.brand{display:flex;align-items:center;gap:12px}
.logo{
  width:40px;height:40px;background:linear-gradient(135deg,#7c3aed,#a855f7);
  border-radius:12px;display:flex;align-items:center;justify-content:center;
  font-size:22px;box-shadow:0 4px 14px rgba(124,58,237,0.35);
}
.title{font-size:17px;font-weight:800;letter-spacing:-0.4px;color:#fff}
.sub{font-size:12px;color:var(--muted)}
.hdr-right{display:flex;align-items:center;gap:12px}
.key-input{
  background:var(--surface2);border:1px solid var(--border);color:var(--text);
  padding:6px 12px;border-radius:8px;font-size:12px;outline:none;width:180px;
}
.key-input::placeholder{color:var(--muted)}

.badge{
  display:flex;align-items:center;gap:6px;font-size:12px;color:var(--green);
  background:rgba(16,185,129,0.12);padding:6px 14px;border-radius:20px;border:1px solid rgba(16,185,129,0.25);
  font-weight:600;
}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green)}

#feed{
  flex:1;overflow-y:auto;padding:24px 20px;display:flex;flex-direction:column;gap:18px;
  scroll-behavior:smooth;
}
#feed::-webkit-scrollbar{width:6px}
#feed::-webkit-scrollbar-thumb{background:var(--border);border-radius:6px}

.msg{display:flex;gap:12px;max-width:850px;animation:fadeIn .25s ease-out}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.msg.user{align-self:flex-end;flex-direction:row-reverse}
.msg.ai{align-self:flex-start}

.av{
  width:36px;height:36px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:16px;flex-shrink:0;margin-top:2px;
}
.av.u{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff}
.av.a{background:var(--surface2);border:1px solid var(--border)}

.bubble{
  padding:15px 18px;border-radius:18px;font-size:14.5px;line-height:1.65;
  max-width:740px;word-break:break-word;box-shadow:0 2px 10px rgba(0,0,0,0.25);
}
.msg.user .bubble{
  background:linear-gradient(135deg,#2e1065,#4c1d95);
  border:1px solid #6d28d9;border-top-right-radius:4px;color:#fff;
}
.msg.ai .bubble{
  background:var(--surface);border:1px solid var(--border);border-top-left-radius:4px;color:var(--text);
}
.bubble a{color:#60a5fa;text-decoration:none;font-weight:600}
.bubble a:hover{text-decoration:underline}
.bubble strong{color:#c084fc;font-weight:700}
.bubble hr{border:none;border-top:1px solid var(--border);margin:12px 0}
.bubble code{background:#1e1e2e;padding:2px 6px;border-radius:5px;font-size:13px;color:#f472b6}

.chips-bar{
  padding:12px 20px;background:var(--bg);border-top:1px solid rgba(255,255,255,0.05);
  display:flex;gap:10px;overflow-x:auto;flex-shrink:0;
}
.chips-bar::-webkit-scrollbar{height:4px}
.chips-bar::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}

.chip-btn{
  background:var(--surface2);border:1px solid var(--border);color:#e2e8f0;
  padding:9px 16px;border-radius:24px;font-size:13px;font-weight:600;
  cursor:pointer;white-space:nowrap;transition:all .18s ease;display:flex;align-items:center;gap:6px;
  user-select:none;
}
.chip-btn:hover{
  border-color:var(--accent);background:#25164d;color:#fff;transform:translateY(-2px);
  box-shadow:0 4px 14px rgba(139,92,246,0.3);
}
.chip-btn:active{transform:scale(0.96)}

#status-banner{
  display:none;padding:12px 20px;background:#1e1040;border-top:1px solid #4c1d95;
  font-size:13.5px;color:#c084fc;font-weight:600;align-items:center;gap:10px;flex-shrink:0;
}
#status-banner.active{display:flex}
.spinner{display:inline-block;animation:spin 1s linear infinite;font-size:16px}
@keyframes spin{to{transform:rotate(360deg)}}

.input-wrapper{
  padding:14px 20px 20px;background:var(--surface);border-top:1px solid var(--border);
  flex-shrink:0;
}
.bar{
  display:flex;gap:10px;align-items:center;background:var(--surface2);
  border:1px solid var(--border);border-radius:20px;padding:6px 8px 6px 18px;
  transition:border-color .2s;
}
.bar:focus-within{border-color:var(--accent);box-shadow:0 0 0 2px rgba(139,92,246,0.2)}

#message-input{
  flex:1;background:transparent;border:none;color:var(--text);font-size:15px;
  font-family:inherit;outline:none;resize:none;max-height:100px;min-height:26px;
  line-height:1.5;overflow-y:auto;
}
#message-input::-webkit-scrollbar{display:none}
#message-input::placeholder{color:var(--muted)}

#send-btn{
  width:46px;height:46px;background:linear-gradient(135deg,#7c3aed,#a855f7);
  border:none;border-radius:14px;cursor:pointer;display:flex;align-items:center;
  justify-content:center;flex-shrink:0;transition:all .18s;outline:none;
}
#send-btn:hover{opacity:0.92;transform:scale(1.05)}
#send-btn:active{transform:scale(0.95)}
#send-btn:disabled{opacity:0.35;cursor:not-allowed;transform:none}
#send-btn svg{width:20px;height:20px;fill:#fff}

.typing-dots{display:flex;gap:5px;padding:6px 4px}
.typing-dots span{width:8px;height:8px;background:var(--muted);border-radius:50%;animation:bounce 1.2s infinite}
.typing-dots span:nth-child(2){animation-delay:.2s}
.typing-dots span:nth-child(3){animation-delay:.4s}
@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
</style>
</head>
<body>

<header>
  <div class="brand">
    <div class="logo">⚡</div>
    <div>
      <div class="title">X AI Lead Finder</div>
      <div class="sub">Playwright Scraper + Gemini AI</div>
    </div>
  </div>
  <div class="hdr-right">
    <input type="password" id="api-key-input" class="key-input" placeholder="Gemini Key (AIzaSy...)" />
    <div class="badge"><div class="dot"></div> Server Online</div>
  </div>
</header>

<div id="feed">
  <div class="msg ai">
    <div class="av a">🤖</div>
    <div class="bubble">
      <strong>Hey there! 👋 I'm Gemini AI.</strong><br><br>
      Ask me anything! Tell me to find micro-niches, generate keywords, or search X live for leads.<br><br>
      <em>Try asking:</em><br>
      • <code>find some very micro niches that we can target</code><br>
      • <code>give 10 leads</code><br>
      • <code>Search X for: need chatbot, hire automation developer</code>
    </div>
  </div>
</div>

<div class="chips-bar">
  <button class="chip-btn" data-text="find some very micro niches that we can target">
    🎯 Find micro niches
  </button>
  <button class="chip-btn" data-text="Give me X search keywords for real estate">
    🔑 Get search keywords
  </button>
  <button class="chip-btn" data-text="Search X for: need automation, hire chatbot developer">
    🚀 Search X for 10 leads
  </button>
  <button class="chip-btn" data-text="How should I price my AI automation services?">
    💰 Pricing strategy
  </button>
</div>

<div id="status-banner"><span class="spinner">⏳</span><span id="status-text">Scraping X...</span></div>

<div class="input-wrapper">
  <div class="bar">
    <textarea id="message-input" placeholder="Ask Gemini AI anything..." rows="1"></textarea>
    <button id="send-btn" type="button" aria-label="Send Message">
      <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  </div>
</div>

<script>
document.addEventListener("DOMContentLoaded", function() {
  var feed = document.getElementById("feed");
  var input = document.getElementById("message-input");
  var sendBtn = document.getElementById("send-btn");
  var apiKeyInput = document.getElementById("api-key-input");
  var statusBanner = document.getElementById("status-banner");
  var statusText = document.getElementById("status-text");
  var isBusy = false;
  var chatHistory = [];

  function renderMarkdown(txt) {
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

  function appendBubble(role, html, rawText) {
    var msgDiv = document.createElement("div");
    msgDiv.className = "msg " + role;
    msgDiv.innerHTML = '<div class="av ' + (role === "user" ? "u" : "a") + '">' +
      (role === "user" ? "👤" : "🤖") + "</div>" +
      '<div class="bubble">' + html + '</div>';
    feed.appendChild(msgDiv);
    feed.scrollTop = feed.scrollHeight;
    if (rawText) {
      chatHistory.push({ role: role === "user" ? "user" : "assistant", content: rawText });
    }
  }

  function showLoader() {
    var div = document.createElement("div");
    div.className = "msg ai";
    div.id = "loader-msg";
    div.innerHTML = '<div class="av a">🤖</div><div class="bubble typing-dots"><span></span><span></span><span></span></div>';
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  }

  function removeLoader() {
    var loader = document.getElementById("loader-msg");
    if (loader) loader.remove();
  }

  function setStatus(active, msg) {
    if (active) {
      statusBanner.classList.add("active");
      statusText.textContent = msg || "Processing...";
    } else {
      statusBanner.classList.remove("active");
    }
  }

  function parseKeywords(text) {
    var lower = text.toLowerCase();
    var idx = lower.indexOf("search x for");
    if (idx === -1) return null;
    var rawKws = text.substring(idx + 12).replace(/^[:\s]+/, "");
    if (!rawKws) return null;
    return rawKws.split(/[,;|]/).map(function(s) {
      return s.trim().replace(/^['"]|['"]$/g, "");
    }).filter(Boolean);
  }

  function triggerSendMessage(customText) {
    if (isBusy) return;
    var query = (customText || input.value || "").trim();
    if (!query) return;

    input.value = "";
    input.style.height = "auto";
    appendBubble("user", renderMarkdown(query), query);

    isBusy = true;
    sendBtn.disabled = true;

    var keywords = parseKeywords(query);
    var userKey = apiKeyInput ? apiKeyInput.value.trim() : "";

    if (keywords && keywords.length > 0) {
      setStatus(true, "Scraping X for keywords: " + keywords.join(", ") + " (1-2 min)...");
      showLoader();

      fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: keywords, apiKey: userKey })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        removeLoader();
        setStatus(false);
        var note = data.totalFound ? "<br><br><small style='color:#94a3b8'>Scraped total: " + data.totalFound + " tweets from X</small>" : "";
        appendBubble("ai", renderMarkdown(data.reply || "Done") + note, data.reply);
      })
      .catch(function(err) {
        removeLoader();
        setStatus(false);
        appendBubble("ai", "⚠️ Connection error: " + err.message);
      })
      .finally(function() {
        isBusy = false;
        sendBtn.disabled = false;
      });
    } else {
      showLoader();

      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, apiKey: userKey, history: chatHistory.slice(-8) })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        removeLoader();
        appendBubble("ai", renderMarkdown(data.reply || "Done"), data.reply);
      })
      .catch(function(err) {
        removeLoader();
        appendBubble("ai", "⚠️ Connection error: " + err.message);
      })
      .finally(function() {
        isBusy = false;
        sendBtn.disabled = false;
      });
    }
  }

  var chipButtons = document.querySelectorAll(".chip-btn");
  chipButtons.forEach(function(btn) {
    btn.addEventListener("click", function() {
      var promptText = this.getAttribute("data-text");
      triggerSendMessage(promptText);
    });
  });

  sendBtn.addEventListener("click", function() {
    triggerSendMessage();
  });

  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      triggerSendMessage();
    }
  });

  input.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 100) + "px";
  });
});
</script>
</body>
</html>"""

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    HTTPServer.allow_reuse_address = True
    server = HTTPServer(('0.0.0.0', PORT), AppRequestHandler)
    print("\n" + "="*55, flush=True)
    print(f"  🚀 DYNAMIC GEMINI AI SERVER RUNNING AT: http://localhost:{PORT}", flush=True)
    print("="*55 + "\n", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...", flush=True)
        server.server_close()

if __name__ == "__main__":
    main()
