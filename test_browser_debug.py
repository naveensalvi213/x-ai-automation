import asyncio
import sys
from playwright.async_api import async_playwright

async def debug_browser():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_logs.append(f"[PAGE ERROR] {err}"))

        print("Navigating to http://localhost:8000...", flush=True)
        try:
            res = await page.goto("http://localhost:8000", wait_until="domcontentloaded", timeout=10000)
            print(f"Status: {res.status}", flush=True)
        except Exception as e:
            print(f"Navigation failed: {e}", flush=True)
            await browser.close()
            return

        await page.wait_for_timeout(1000)

        chips = await page.query_selector_all(".chip-btn")
        print(f"Found {len(chips)} chip buttons", flush=True)

        inp = await page.query_selector("#message-input")
        send_btn = await page.query_selector("#send-btn")
        print(f"Input present: {inp is not None}, Send button present: {send_btn is not None}", flush=True)

        if chips:
            print("Clicking first chip button...", flush=True)
            await chips[0].click()
            await page.wait_for_timeout(2000)

        print("\n--- CONSOLE LOGS ---", flush=True)
        for log in console_logs:
            print(log, flush=True)
        print("--------------------\n", flush=True)

        # Check if new message bubble appeared
        bubbles = await page.query_selector_all(".bubble")
        print(f"Total message bubbles in DOM: {len(bubbles)}", flush=True)

        await browser.close()

if __name__ == "__main__":
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    asyncio.run(debug_browser())
