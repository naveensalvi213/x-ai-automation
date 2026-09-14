import os
import sys
import json
import asyncio
import urllib.parse
from google import genai

# ─── CONFIGURATION FROM ENVIRONMENT ──────────────────────────────────────────

AUTH_TOKEN = os.environ.get("TWITTER_AUTH_TOKEN", "c6289fcc9d99ca623baba0a793c4a85a5be67af3")
CT0_TOKEN  = os.environ.get("TWITTER_CT0", "0dee5e8b0c3b6578fc8a515bb1a5c39172903851fcbe08749d032ebd12aeeae9b7b3630fe445025cd0b0a7a5c377440e47310e811717506e897935e6749506aa5e3ee9bdab27538951298508bfe0a8d9")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "AQ.Ab8RN6Iv19d_KBGtzJIGxc61b_5tUaAE7w8-PF85xXRKjyrcjw")
KEYWORDS   = os.environ.get("KEYWORDS", "need chatbot, hire developer, web scraper, AI automation").split(",")

GEMINI_PROMPT = """You are an elite Sales Lead Qualification AI for a specialized AI Automation Agency.

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

async def run_github_scraper():
    print("🚀 Starting GitHub Actions X Scraper & Gemini Evaluator...", flush=True)
    from playwright.async_api import async_playwright

    all_posts = []
    global_seen = set()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"]
        )
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 900}
        )

        await ctx.add_cookies([
            {"name": "auth_token", "value": AUTH_TOKEN, "domain": ".x.com", "path": "/", "httpOnly": True, "secure": True},
            {"name": "ct0", "value": CT0_TOKEN, "domain": ".x.com", "path": "/", "httpOnly": False, "secure": True}
        ])

        page = await ctx.new_page()

        for kw in KEYWORDS:
            clean_kw = kw.strip()
            if not clean_kw:
                continue

            for suffix, tab_name in [("", "Top"), ("&f=live", "Latest")]:
                url = f"https://x.com/search?q={urllib.parse.quote(clean_kw)}{suffix}&src=typed_query"
                print(f"🔎 Searching '{clean_kw}' ({tab_name})...", flush=True)

                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                    await page.evaluate("window.scrollBy(0, 300)")
                    await asyncio.sleep(1.0)

                    for scroll_idx in range(5):
                        items = await page.evaluate("""() => {
                            let arts = document.querySelectorAll('article[data-testid="tweet"], article, div[data-testid="cellInner"]');
                            return Array.from(arts).map(a => {
                                const nameEl = a.querySelector('[data-testid="User-Name"]');
                                const textEl = a.querySelector('[data-testid="tweetText"]') || a.querySelector('div[dir="auto"]');
                                const linkEl = a.querySelector('a[href*="/status/"]');
                                const timeEl = a.querySelector('time');
                                const rawName = nameEl ? nameEl.innerText : '';
                                const lines   = rawName.split('\\n').map(s=>s.trim()).filter(Boolean);
                                return {
                                    name:      lines.find(l=>!l.startsWith('@')) || 'X User',
                                    handle:    lines.find(l=>l.startsWith('@'))  || '',
                                    text:      textEl ? textEl.innerText : (a ? a.innerText : ''),
                                    path:      linkEl ? linkEl.getAttribute('href') : '',
                                    timestamp: timeEl ? timeEl.getAttribute('datetime') : ''
                                };
                            });
                        }""")

                        for t in items:
                            if t["path"] and t["path"] not in global_seen and len(t["text"].strip()) > 10:
                                global_seen.add(t["path"])
                                handle_clean = t["handle"].lstrip("@")
                                all_posts.append({
                                    "name": t["name"],
                                    "handle": t["handle"] or f"@{handle_clean}",
                                    "text": t["text"],
                                    "tweetUrl": "https://x.com" + t["path"],
                                    "profileUrl": f"https://x.com/{handle_clean}" if handle_clean else "https://x.com",
                                    "keyword": clean_kw,
                                    "section": tab_name
                                })

                        await page.evaluate("window.scrollBy({top: 1000, behavior: 'smooth'})")
                        await asyncio.sleep(0.6)

                except Exception as err:
                    print(f"⚠️ Error on '{clean_kw}': {err}", flush=True)

        await browser.close()

    print(f"✅ Extracted {len(all_posts)} total posts across keywords!", flush=True)

    if not all_posts:
        print("No posts found to evaluate.")
        return

    # Send to Gemini
    print("🤖 Sending posts to Gemini 3.6 AI for Lead Qualification...", flush=True)
    try:
        client = genai.Client(api_key=GEMINI_KEY)
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=f"{GEMINI_PROMPT}\n\nTWEETS:\n{json.dumps(all_posts[:40], indent=2)}"
        )
        report = response.text or ""
        
        # Save output artifact
        with open("latest_leads.json", "w", encoding="utf-8") as f:
            f.write(report)

        print("\n" + "="*50)
        print("🎯 GEMINI 3.6 QUALIFIED LEADS SUMMARY:")
        print("="*50)
        print(report)
        print("="*50 + "\n")

    except Exception as gem_err:
        print(f"❌ Gemini Qualification Error: {gem_err}", flush=True)

if __name__ == "__main__":
    asyncio.run(run_github_scraper())
