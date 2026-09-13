# X (Twitter) AI Automation Lead Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack X (Twitter) AI automation lead generation tool featuring a native Expo (React Native) mobile chat interface, Node.js + Playwright scrapers for X "Top" and "Latest" tabs, Gemini API lead qualification, and Docker configuration for 24/7 Render deployment.

**Architecture:** A Node.js Express server runs Playwright headlessly in Docker on Render. It receives search triggers from an Expo React Native mobile app via REST/Socket.io, scrapes X search feeds using injected session cookies (`auth_token`), filters and ranks intent via Gemini API, and streams structured leads back to the mobile UI.

**Tech Stack:** Node.js (v20), Express.js, Playwright (Chromium), `@google/genai` SDK, React Native (Expo), Socket.io.

## Global Constraints

- **Gemini API Key**: `AQ.Ab8RN6JvkY_4jiC_fzmBr7xtDhOBUYNh2qD7UUHbox3EriGcNA`
- **X Auth Token**: `c2da45c233f3df908c9e6ab309afc01f36efb441`
- **Port**: `10000`
- **Scraper Target Tabs**: `Latest` (`f=live`) and `Top` (`default search`)

---

### Task 1: Node.js Express & Playwright X Scraper Engine

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/scraper.js`
- Create: `backend/src/server.js`
- Test: `backend/tests/scraper.test.js`

**Interfaces:**
- Produces: `scrapeXKeywords({ keywords: string[], maxLeadsPerKeyword: number, authToken: string }): Promise<Array<TweetData>>`
- TweetData shape: `{ authorName: string, authorHandle: string, bio: string, tweetText: string, tweetUrl: string, profileUrl: string, timestamp: string, likes: number, retweets: number, sourceTab: 'Latest' | 'Top' }`

- [ ] **Step 1: Create backend dependencies & configuration**

```json
{
  "name": "x-lead-finder-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "@google/genai": "^0.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "playwright": "^1.42.1",
    "socket.io": "^4.7.5"
  }
}
```

- [ ] **Step 2: Create Playwright X scraper implementation (`backend/src/scraper.js`)**

```javascript
import { chromium } from 'playwright';

export async function scrapeXKeywords({ keywords, maxLeadsPerKeyword = 10, authToken }) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  // Inject auth_token cookie for x.com
  await context.addCookies([
    {
      name: 'auth_token',
      value: authToken,
      domain: '.x.com',
      path: '/',
      httpOnly: true,
      secure: true
    }
  ]);

  const page = await context.newPage();
  const allResults = [];

  for (const kw of keywords) {
    const tabs = [
      { name: 'Latest', url: `https://x.com/search?q=${encodeURIComponent(kw)}&f=live` },
      { name: 'Top', url: `https://x.com/search?q=${encodeURIComponent(kw)}` }
    ];

    for (const tab of tabs) {
      try {
        await page.goto(tab.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        let scrapedCount = 0;
        let scrollAttempts = 0;

        while (scrapedCount < maxLeadsPerKeyword && scrollAttempts < 10) {
          const tweets = await page.evaluate(() => {
            const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
            return articles.map(art => {
              const userEl = art.querySelector('div[data-testid="User-Name"]');
              const textEl = art.querySelector('div[data-testid="tweetText"]');
              const timeEl = art.querySelector('time');
              const linkEl = art.querySelector('a[href*="/status/"]');

              const authorName = userEl ? userEl.innerText.split('\n')[0] : 'Unknown';
              const handleMatch = userEl ? userEl.innerText.match(/@[\w_]+/) : null;
              const authorHandle = handleMatch ? handleMatch[0] : '';
              const tweetText = textEl ? textEl.innerText : '';
              const timestamp = timeEl ? timeEl.getAttribute('datetime') : new Date().toISOString();
              const tweetPath = linkEl ? linkEl.getAttribute('href') : '';

              return {
                authorName,
                authorHandle,
                tweetText,
                timestamp,
                tweetUrl: tweetPath ? `https://x.com${tweetPath}` : '',
                profileUrl: authorHandle ? `https://x.com/${authorHandle.replace('@', '')}` : ''
              };
            });
          });

          for (const tw of tweets) {
            if (tw.tweetText && tw.authorHandle && !allResults.some(r => r.tweetUrl === tw.tweetUrl)) {
              allResults.push({ ...tw, sourceTab: tab.name, keyword: kw });
              scrapedCount++;
            }
          }

          await page.evaluate(() => window.scrollBy(0, 1000));
          await page.waitForTimeout(2000);
          scrollAttempts++;
        }
      } catch (err) {
        console.error(`Error scraping ${kw} on ${tab.name}:`, err.message);
      }
    }
  }

  await browser.close();
  return allResults;
}
```

- [ ] **Step 3: Run backend scraper verification test**

Run: `node --test backend/tests/scraper.test.js`
Expected: PASS (Scraper functions properly formatted results array)

---

### Task 2: Gemini AI Lead Qualification & Chat Server Setup

**Files:**
- Create: `backend/src/geminiService.js`
- Create: `backend/src/server.js`
- Test: `backend/tests/gemini.test.js`

**Interfaces:**
- Consumes: `scrapeXKeywords` output array
- Produces: `qualifyLeadsWithGemini({ tweets: Array<TweetData>, userCriteria?: string }): Promise<Array<QualifiedLead>>`
- QualifiedLead shape: `{ name: string, handle: string, profileUrl: string, tweetUrl: string, tweetText: string, matchScore: number, matchReasoning: string, suggestedDm: string }`

- [ ] **Step 1: Create Gemini Service (`backend/src/geminiService.js`)**

```javascript
import { GoogleGenAI } from '@google/genai';

export async function qualifyLeadsWithGemini({ tweets, userCriteria = 'Looking for AI automation, chatbots, workflow automation, or agency services', apiKey }) {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert AI Lead Qualification Agent for an AI Automation Agency.
Analyze the following list of X (Twitter) posts gathered from search. Filter out spam, bots, agencies promoting themselves, news articles, and low-intent posts.

Identify TRUE potential clients/leads who need AI automation, chatbots, web scraping, custom workflows, or CRM integration.

Lead Qualification Criteria:
${userCriteria}

Input Scraped Tweets:
${JSON.stringify(tweets, null, 2)}

Return a JSON array of qualified leads with this exact structure:
[
  {
    "name": "Display Name",
    "handle": "@username",
    "profileUrl": "https://x.com/username",
    "tweetUrl": "https://x.com/username/status/123",
    "tweetText": "Full text of post",
    "matchScore": 95,
    "matchReasoning": "User explicitly stated they need an AI chatbot for their e-commerce store.",
    "suggestedDm": "Hey [Name], saw your tweet about needing an e-commerce chatbot..."
  }
]
Reply ONLY with valid JSON array, no markdown backticks.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  const text = response.text.trim().replace(/^```json/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse Gemini output:', text);
    return [];
  }
}
```

- [ ] **Step 2: Create Express Server (`backend/src/server.js`)**

```javascript
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { scrapeXKeywords } from './scraper.js';
import { qualifyLeadsWithGemini } from './geminiService.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6JvkY_4jiC_fzmBr7xtDhOBUYNh2qD7UUHbox3EriGcNA';
const TWITTER_AUTH_TOKEN = process.env.TWITTER_AUTH_TOKEN || 'c2da45c233f3df908c9e6ab309afc01f36efb441';

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'X AI Automation Lead Finder' }));

app.post('/api/search-leads', async (req, res) => {
  const { keywords, maxLeadsPerKeyword = 5, criteria } = req.body;
  if (!keywords || !Array.isArray(keywords)) {
    return res.status(400).json({ error: 'keywords array required' });
  }

  try {
    console.log(`Starting scraper for keywords: ${keywords.join(', ')}`);
    const scrapedTweets = await scrapeXKeywords({
      keywords,
      maxLeadsPerKeyword,
      authToken: TWITTER_AUTH_TOKEN
    });

    console.log(`Scraped ${scrapedTweets.length} tweets. Evaluating with Gemini...`);
    const qualifiedLeads = await qualifyLeadsWithGemini({
      tweets: scrapedTweets,
      userCriteria: criteria,
      apiKey: GEMINI_API_KEY
    });

    res.json({ success: true, totalScraped: scrapedTweets.length, leads: qualifiedLeads });
  } catch (err) {
    console.error('Search Leads Error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

### Task 3: Render Dockerfile & Deployment Configuration

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `render.yaml`

- [ ] **Step 1: Create Dockerfile with Playwright dependencies**

```dockerfile
FROM mcr.microsoft.com/playwright:v1.42.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]
```

- [ ] **Step 2: Create Render configuration (`render.yaml`)**

```yaml
services:
  - type: web
    name: x-ai-lead-finder-backend
    env: docker
    dockerfilePath: backend/Dockerfile
    plan: starter
    region: oregon
    envVars:
      - key: PORT
        value: 10000
      - key: GEMINI_API_KEY
        value: AQ.Ab8RN6JvkY_4jiC_fzmBr7xtDhOBUYNh2qD7UUHbox3EriGcNA
      - key: TWITTER_AUTH_TOKEN
        value: c2da45c233f3df908c9e6ab309afc01f36efb441
```

---

### Task 4: Expo React Native Mobile App Frontend

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/App.js`
- Create: `mobile/src/components/ChatScreen.js`
- Create: `mobile/src/components/LeadCard.js`

- [ ] **Step 1: Setup Expo mobile app structure (`mobile/App.js`)**

Features:
- Dark theme styled chat UI.
- Direct interaction with Gemini AI backend.
- Keyword recommendation buttons.
- Render connection configuration.
- Clickable Lead Cards with direct profile and tweet opening (`Linking.openURL`).

---

## Verification Plan

### Automated Verification
1. Run backend syntax & structure checks.
2. Verify Dockerfile builds locally or builds cleanly on Render.

### Manual Verification
1. Launch Express backend on `http://localhost:10000`.
2. Post search request to `/api/search-leads` with `["need ai automation"]`.
3. Verify Playwright launches headlessly, scrapes X Top and Latest tabs, and Gemini returns qualified lead cards with direct links.
