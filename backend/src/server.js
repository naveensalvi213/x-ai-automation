import express from 'express';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { scrapeXKeywords } from './scraper.js';
import {
  qualifyLeadsWithGemini,
  chatWithGemini,
  DEFAULT_GEMINI_API_KEY
} from './geminiService.js';

dotenv.config();

export const DEFAULT_TWITTER_AUTH_TOKEN =
  process.env.TWITTER_AUTH_TOKEN || 'c2da45c233f3df908c9e6ab309afc01f36efb441';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Real-time connection handler
io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    // Socket teardown
  });
});

/**
 * GET /health
 * Service health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'X AI Automation Lead Finder'
  });
});

/**
 * POST /api/chat
 * Interactive conversational AI handler for niche suggestions and keyword ideas
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, apiKey } = req.body || {};
    const result = await chatWithGemini({
      messages,
      apiKey: apiKey || DEFAULT_GEMINI_API_KEY
    });
    return res.json({ reply: result.reply });
  } catch (err) {
    console.error('Error in /api/chat:', err.message);
    return res.status(500).json({
      error: err.message || 'Failed to process chat request'
    });
  }
});

/**
 * POST /api/search-leads
 * Scrapes X for keywords and qualifies leads using Gemini AI
 */
app.post('/api/search-leads', async (req, res) => {
  try {
    let { keywords, maxLeadsPerKeyword = 5, criteria, authToken, apiKey } = req.body || {};

    // Normalize comma-separated string if passed
    if (typeof keywords === 'string') {
      keywords = keywords.split(',').map((k) => k.trim()).filter(Boolean);
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'keywords array is required and cannot be empty'
      });
    }

    const effectiveAuthToken = authToken || DEFAULT_TWITTER_AUTH_TOKEN;
    const effectiveApiKey = apiKey || DEFAULT_GEMINI_API_KEY;
    const limit = Number(maxLeadsPerKeyword) || 5;

    io.emit('search:status', {
      status: 'scraping',
      keywords,
      maxLeadsPerKeyword: limit,
      message: `Starting scrape for ${keywords.length} keywords...`
    });

    // Step 1: Scrape tweets from X using Playwright
    const scrapedTweets = await scrapeXKeywords({
      keywords,
      maxLeadsPerKeyword: limit,
      authToken: effectiveAuthToken
    });

    io.emit('search:status', {
      status: 'qualifying',
      totalScraped: scrapedTweets.length,
      message: `Scraped ${scrapedTweets.length} tweets. Qualifying leads with Gemini AI...`
    });

    // Step 2: Qualify leads with Gemini AI
    const leads = await qualifyLeadsWithGemini({
      tweets: scrapedTweets,
      userCriteria: criteria,
      apiKey: effectiveApiKey
    });

    io.emit('search:status', {
      status: 'completed',
      totalScraped: scrapedTweets.length,
      totalQualified: leads.length,
      message: `Completed qualification. Found ${leads.length} high-intent leads.`
    });

    return res.json({
      success: true,
      totalScraped: scrapedTweets.length,
      leads
    });
  } catch (err) {
    console.error('Error in /api/search-leads:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'An error occurred during lead search and qualification'
    });
  }
});

const PORT = process.env.PORT || 10000;

export function isDirectlyExecuted() {
  if (!process.argv[1]) return false;
  const currentFilePath = path.resolve(fileURLToPath(import.meta.url)).toLowerCase();
  const entryFilePath = path.resolve(process.argv[1]).toLowerCase();
  return currentFilePath === entryFilePath;
}

// Only listen if executed directly and not under test
if (isDirectlyExecuted() && process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 X AI Automation Lead Finder server listening on port ${PORT}`);
  });
}

export { app, server, io };
export default app;
