# Render Deployment & Mobile Integration Guide

This guide provides step-by-step instructions for deploying the **X AI Automation Lead Finder Backend** to [Render](https://render.com) using Docker, configuring live environment variables, verifying health endpoints, and connecting your Expo React Native mobile frontend.

---

## 1. Architecture & Container Overview

The backend service runs Node.js, Express, Socket.IO, and Playwright Chromium for scraping real-time leads from X (Twitter), combined with Google Gemini AI for buyer qualification and personalized DM generation.

- **Base Image:** `mcr.microsoft.com/playwright:v1.42.1-jammy` (pre-bundled with Ubuntu Jammy, Node.js, Chromium, and Linux graphical rendering dependencies).
- **Default Port:** `10000` (`ENV PORT=10000`, `EXPOSE 10000`).
- **Recommended Render Plan:** **Starter** ($7/mo) or higher.
  > ⚠️ **Why Starter?** Playwright launches headless Chromium browsers to scrape tweets. Headless Chromium requires at least 512MB–1GB RAM. The Render Free tier (512MB RAM with strict spin-down) can suffer out-of-memory (OOM) errors during simultaneous browser sessions. The Starter plan provides dedicated CPU, 512MB–1GB+ RAM, and zero spin-down.

---

## 2. Deployment Options on Render

You can deploy the service using either **Option A: Render Blueprint (`render.yaml`)** (recommended, automated) or **Option B: Manual Dashboard Setup**.

### Option A: Deploy via Render Blueprint (`render.yaml`)

1. Push this entire project repository to GitHub or GitLab.
2. Log into your [Render Dashboard](https://dashboard.render.com).
3. In the top navigation, click **New +** and select **Blueprint**.
4. Connect your GitHub/GitLab repository and grant access.
5. Render will automatically detect `render.yaml` at the root of the repository:
   - Service Name: `x-ai-lead-finder-backend`
   - Environment: `Docker`
   - Dockerfile: `backend/Dockerfile`
   - Build Context: `backend`
   - Region: `Oregon (US West)`
   - Plan: `Starter`
   - Health Check Path: `/health`
6. Click **Apply**. Render will trigger the Docker container build and provision the web service.

---

### Option B: Manual Web Service Setup via Render Dashboard

If you prefer configuring the service manually without Blueprints:

1. In the Render Dashboard, click **New +** and select **Web Service**.
2. Select **Build and deploy from a Git repository** and connect your repository.
3. Configure the service settings:
   - **Name:** `x-ai-lead-finder-backend`
   - **Region:** `Oregon (US West)` (or closest to your users)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank or set to repository root)*
   - **Runtime / Environment:** **Docker**
   - **Dockerfile Path:** `backend/Dockerfile`
   - **Docker Context:** `backend`
   - **Instance Type / Plan:** **Starter**
4. Under **Advanced Settings**:
   - **Health Check Path:** `/health`
   - **Auto-Deploy:** `Yes`
5. Proceed to the Environment Variables section below before clicking **Create Web Service**.

---

## 3. Configuring Environment Variables

In your Render Service Dashboard, navigate to **Environment** (or **Environment Variables**) and configure the following variables:

| Variable Name | Recommended Value / Description | Sensitive |
| :--- | :--- | :---: |
| `PORT` | `10000` | No |
| `NODE_ENV` | `production` | No |
| `GEMINI_API_KEY` | `AQ.Ab8RN6JvkY_4jiC_fzmBr7xtDhOBUYNh2qD7UUHbox3EriGcNA` *(or your custom Google Gemini API Key)* | Yes |
| `TWITTER_AUTH_TOKEN` | `c2da45c233f3df908c9e6ab309afc01f36efb441` *(or fresh `auth_token` cookie from X)* | Yes |

> 💡 **Tip for Updating X Auth Token:**  
> The `TWITTER_AUTH_TOKEN` is the `auth_token` session cookie extracted from your browser when logged into `x.com`. If sessions expire or Twitter invalidates the cookie, simply update `TWITTER_AUTH_TOKEN` in the Render Environment tab and click **Save Changes** (Render will instantly redeploy without rebuilding the Docker image).

---

## 4. Verifying the Deployment

Once the build finishes and the service status displays **"Live"**, your service will have a public URL like:
```text
https://x-ai-lead-finder-backend.onrender.com
```

### 4.1 Verify Health Check

Run the following curl command in PowerShell or terminal:

```bash
curl -i https://x-ai-lead-finder-backend.onrender.com/health
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "service": "X AI Automation Lead Finder"
}
```

### 4.2 Verify AI Chat Endpoint (`POST /api/chat`)

Test the Gemini conversational assistant for keyword suggestions:

```bash
curl -X POST https://x-ai-lead-finder-backend.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Suggest 3 high-intent search keywords to find businesses needing AI customer service automation on X."}]}'
```

**Expected Response:**
```json
{
  "reply": "... AI strategy suggestions and high-intent X search queries ..."
}
```

### 4.3 Verify Lead Search & AI Qualification (`POST /api/search-leads`)

Test scraping and lead scoring:

```bash
curl -X POST https://x-ai-lead-finder-backend.onrender.com/api/search-leads \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["looking for AI automation agency", "need AI bot developer"],
    "maxLeadsPerKeyword": 3,
    "criteria": "High budget clients seeking AI workflow automation or custom bot solutions"
  }'
```

---

## 5. Connecting the Expo React Native Mobile App

Follow these steps to wire your Expo React Native application to the live Render backend.

### 5.1 Environment Configuration (`.env` or `app.json`)

In your Expo project root, create or update `.env`:

```env
# Production Render Backend URL (without trailing slash)
EXPO_PUBLIC_API_URL=https://x-ai-lead-finder-backend.onrender.com
```

Or configure inside `app.json` / `app.config.js`:

```json
{
  "expo": {
    "name": "XLeadFinder",
    "slug": "x-lead-finder",
    "extra": {
      "apiUrl": "https://x-ai-lead-finder-backend.onrender.com"
    }
  }
}
```

### 5.2 API Client Configuration (`services/api.js`)

Create a centralized API client in your mobile app:

```javascript
// services/api.js
import Constants from 'expo-constants';

const API_BASE_URL = 
  process.env.EXPO_PUBLIC_API_URL || 
  Constants.expoConfig?.extra?.apiUrl || 
  'http://localhost:10000';

/**
 * Health Check
 */
export async function checkServerHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  return response.json();
}

/**
 * AI Strategy & Keyword Chat
 */
export async function sendChatMessage(messages, apiKey) {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, apiKey })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Chat request failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Search & Qualify Leads
 */
export async function searchAndQualifyLeads({ keywords, maxLeadsPerKeyword, criteria, authToken, apiKey }) {
  const response = await fetch(`${API_BASE_URL}/api/search-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keywords,
      maxLeadsPerKeyword,
      criteria,
      authToken,
      apiKey
    })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Lead search failed: ${response.status}`);
  }
  return response.json();
}

export { API_BASE_URL };
```

### 5.3 Real-Time WebSocket Connection with Socket.IO

The backend emits real-time progress events (`search:status`) over WebSockets. Install the client in your mobile project:

```bash
npx expo install socket.io-client
```

Connect using `io` from `socket.io-client`:

```javascript
// services/socket.js
import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socket = null;

export function getSocketInstance() {
  if (!socket) {
    // Render supports secure WebSockets over HTTPS (wss://) automatically
    socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 20000
    });

    socket.on('connect', () => {
      console.log('Connected to Render WebSocket server, socket ID:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('WebSocket connection error:', err.message);
    });
  }
  return socket;
}

export function subscribeToSearchProgress(callback) {
  const s = getSocketInstance();
  s.on('search:status', callback);
  return () => {
    s.off('search:status', callback);
  };
}
```

### 5.4 Using Real-Time Progress in React Native Components

```jsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { subscribeToSearchProgress } from './services/socket';

export function ProgressBanner() {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToSearchProgress((data) => {
      // data: { status: 'scraping' | 'qualifying' | 'completed', message: '...' }
      setProgress(data);
    });
    return unsubscribe;
  }, []);

  if (!progress) return null;

  return (
    <View style={{ padding: 12, backgroundColor: '#1e293b', borderRadius: 8, margin: 10 }}>
      <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>Status: {progress.status.toUpperCase()}</Text>
      <Text style={{ color: '#f8fafc', marginTop: 4 }}>{progress.message}</Text>
      {progress.status !== 'completed' && (
        <ActivityIndicator size="small" color="#38bdf8" style={{ marginTop: 8 }} />
      )}
    </View>
  );
}
```

---

## 6. Production Considerations & Troubleshooting

### 6.1 Cold Start Delays
- If using the **Free plan**, Render puts web services to sleep after 15 minutes of inactivity. The first request will take 30–60 seconds to spin up.
- **Starter plan** keeps the service running 24/7 without cold starts.
- Add an initial ping to `/health` when your mobile app opens to warm up the connection.

### 6.2 Docker Build Optimization
- The Dockerfile uses `COPY package*.json ./` followed by `RUN npm ci` before copying the rest of the source code. This ensures Render reuses cached layers unless `package.json` changes, drastically speeding up deploys.

### 6.3 X (Twitter) Rate Limits & Session Expiry
- If requests fail with empty lead arrays, verify whether your `TWITTER_AUTH_TOKEN` is still valid by inspecting cookies in an incognito browser window.
- The scraper automatically launches Chromium with `--no-sandbox`, `--disable-setuid-sandbox`, and `--disable-dev-shm-usage` flags, which ensures stability inside Docker on Linux.

### 6.4 Viewing Live Render Logs
- In Render Dashboard, click your service and select **Logs** tab.
- Look for:
  ```text
  🚀 X AI Automation Lead Finder server listening on port 10000
  ```
- Live HTTP access logs and Playwright scraping logs appear in real-time.
