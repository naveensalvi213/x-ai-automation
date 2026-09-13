# Design Spec: X (Twitter) AI Automation Lead Finder & Mobile Native App

## 1. Overview
The **X AI Automation Lead Finder** is a client acquisition system consisting of:
1. **Expo (React Native) Mobile App**: A native ChatGPT/Gemini-style chat interface for iOS and Android.
2. **Node.js Express + Playwright Backend**: A 24/7 server hostable on Render with Docker support for headless Playwright Chrome scraping.
3. **Gemini AI Integration**: Generates niches, keyword ideas, evaluates scraped tweets/profiles from X's "Top" and "Latest" search tabs, and returns structured lead profiles with personalized outreach DMs.

---

## 2. Core Functional Requirements

### 2.1 Conversational AI Interface
- Real-time streaming chat interface with Gemini AI.
- Niche exploration & keyword suggestions tailored for AI automation services.
- Flexible prompt commands (e.g., *"Search X for keywords 'need AI chatbot', find 10 leads"*).

### 2.2 Automated X (Twitter) Scraping Engine
- Headless Playwright Chrome browser automated via custom cookie injection using the user's `auth_token`.
- Dual Tab Search: Scrapes both **"Latest"** (`f=live`) and **"Top"** search results for each specified keyword.
- Dynamic Infinite Scroll: Scrolls feed down iteratively until the requested lead capacity or maximum pagination limit is reached.
- Data Extraction: Scrapes post text, author handle, display name, user bio, tweet URL, timestamp, and engagement counts.

### 2.3 Gemini Lead Qualification & Enrichment
- Analyzes raw scraped tweets using Gemini API key (`AQ.Ab8RN6JvkY_4jiC_fzmBr7xtDhOBUYNh2qD7UUHbox3EriGcNA`).
- Evaluates buyer intent, filters out noise/bots/agencies, and ranks high-converting leads.
- Generates structured JSON output:
  - Lead Name & `@handle`
  - Direct Profile URL & Tweet URL
  - Intent Summary & Match Score (0-100%)
  - Custom DM Pitch

### 2.4 24/7 Render Hosting Architecture
- Docker container build with Playwright Chromium runtime dependencies pre-installed.
- SQLite persistent storage for saving chat threads, search history, and saved leads.
- REST API and WebSockets (Socket.io) for live background scraping status updates.

---

## 3. Technology Stack

### Mobile App (Frontend)
- **Framework**: Expo (React Native) + TypeScript
- **Styling**: Tailwind / NativeWind / React Native Paper (Dark Mode First UI)
- **State & Networking**: React Context API + Axios + Socket.io-client

### Backend Engine
- **Runtime**: Node.js v20 + Express.js + Socket.io
- **Scraper**: Playwright (Headless Chromium) with cookie session management
- **AI SDK**: `@google/genai` (Gemini API)
- **Database**: SQLite (via `better-sqlite3` or Prisma)

---

## 4. Deployment Architecture on Render
- **Dockerfile**:
  - Base Image: `mcr.microsoft.com/playwright:v1.40.0-jammy`
  - Exposes port `10000`.
- **Environment Variables**:
  - `GEMINI_API_KEY`: Gemini Key provided by user
  - `TWITTER_AUTH_TOKEN`: X session auth_token provided by user (`c2da45c233f3df908c9e6ab309afc01f36efb441`)
  - `PORT`: `10000`

---

## 5. Security & Verification
- Auth cookie isolation per Playwright context.
- Input validation on search query params and lead thresholds.
- Exception handling for X rate limits and layout updates.
