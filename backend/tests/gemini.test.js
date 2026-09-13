import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

import {
  parseGeminiJsonResponse,
  qualifyLeadsWithGemini,
  chatWithGemini,
  DEFAULT_GEMINI_API_KEY
} from '../src/geminiService.js';
import { app, server } from '../src/server.js';

describe('Gemini JSON Response Parser Unit Tests', () => {
  it('should parse standard clean JSON array', () => {
    const raw = '[{"name":"Alice","handle":"@alice","matchScore":90}]';
    const result = parseGeminiJsonResponse(raw);
    assert.deepStrictEqual(result, [{ name: 'Alice', handle: '@alice', matchScore: 90 }]);
  });

  it('should parse standard clean JSON object', () => {
    const raw = '{"status":"success","count":5}';
    const result = parseGeminiJsonResponse(raw);
    assert.deepStrictEqual(result, { status: 'success', count: 5 });
  });

  it('should strip markdown ```json code blocks', () => {
    const raw = '```json\n[{"name":"Bob","matchScore":85}]\n```';
    const result = parseGeminiJsonResponse(raw);
    assert.deepStrictEqual(result, [{ name: 'Bob', matchScore: 85 }]);
  });

  it('should strip generic markdown ``` code blocks', () => {
    const raw = '```\n[{"name":"Charlie","matchScore":75}]\n```';
    const result = parseGeminiJsonResponse(raw);
    assert.deepStrictEqual(result, [{ name: 'Charlie', matchScore: 75 }]);
  });

  it('should extract JSON array when surrounded by preamble commentary', () => {
    const raw = 'Here is the qualified lead data you requested:\n[{"name":"Dave","matchScore":80}]\nHope this helps!';
    const result = parseGeminiJsonResponse(raw);
    assert.deepStrictEqual(result, [{ name: 'Dave', matchScore: 80 }]);
  });

  it('should return null for empty, null, or non-string values', () => {
    assert.strictEqual(parseGeminiJsonResponse(''), null);
    assert.strictEqual(parseGeminiJsonResponse(null), null);
    assert.strictEqual(parseGeminiJsonResponse(undefined), null);
    assert.strictEqual(parseGeminiJsonResponse(123), null);
  });

  it('should throw an informative error when content cannot be parsed as JSON', () => {
    assert.throws(
      () => parseGeminiJsonResponse('This is completely unparseable text with no json'),
      /Failed to parse Gemini JSON output/
    );
  });
});

describe('Gemini Lead Qualification Input Validation', () => {
  it('should return empty array when tweets array is empty', async () => {
    const result = await qualifyLeadsWithGemini({ tweets: [] });
    assert.deepStrictEqual(result, []);
  });

  it('should return empty array when tweets is not provided', async () => {
    const result = await qualifyLeadsWithGemini({});
    assert.deepStrictEqual(result, []);
  });

  it('should return empty array when called with no arguments', async () => {
    const result = await qualifyLeadsWithGemini();
    assert.deepStrictEqual(result, []);
  });

  it('should return empty array when tweets is null or not an array', async () => {
    const result = await qualifyLeadsWithGemini({ tweets: null });
    assert.deepStrictEqual(result, []);
  });

  it('should throw error when apiKey is empty string', async () => {
    await assert.rejects(
      async () => {
        await qualifyLeadsWithGemini({
          tweets: [{ tweetText: 'Need an AI bot' }],
          apiKey: ''
        });
      },
      /Gemini API key is required/
    );
  });
});

describe('Gemini Live AI Lead Qualification Evaluation', () => {
  it('should accurately filter spam/competitors and identify high-intent buyer leads', async () => {
    const sampleTweets = [
      {
        authorName: 'Sarah Jenkins',
        authorHandle: '@sjenkins_ops',
        tweetText: 'Our e-commerce store is drowning in manual order tracking and customer support emails. Can anyone build or recommend a custom AI chatbot and automated scraper for Shopify? Ready to hire immediately.',
        tweetUrl: 'https://x.com/sjenkins_ops/status/1880000000000000001',
        profileUrl: 'https://x.com/sjenkins_ops'
      },
      {
        authorName: 'Bot Builder Agency',
        authorHandle: '@cheap_bots_agency',
        tweetText: '🚀 We build custom AI chatbots and web scrapers for $199! DM us today to scale your business with our AI agency!',
        tweetUrl: 'https://x.com/cheap_bots_agency/status/1880000000000000002',
        profileUrl: 'https://x.com/cheap_bots_agency'
      },
      {
        authorName: 'Coffee Lover',
        authorHandle: '@latte_life',
        tweetText: 'Had the best double espresso this morning at the local cafe. Happy Monday everyone! ☕',
        tweetUrl: 'https://x.com/latte_life/status/1880000000000000003',
        profileUrl: 'https://x.com/latte_life'
      }
    ];

    const qualified = await qualifyLeadsWithGemini({
      tweets: sampleTweets,
      userCriteria: 'E-commerce businesses seeking AI chatbots or scrapers to reduce manual work'
    });

    assert.ok(Array.isArray(qualified), 'Result should be an array');
    assert.ok(qualified.length >= 1, 'Should find at least 1 qualified buyer lead');

    // Verify Sarah Jenkins is qualified
    const buyerLead = qualified.find(
      (l) => l.handle.toLowerCase().includes('sjenkins') || l.name.toLowerCase().includes('sarah')
    );
    assert.ok(buyerLead, 'High intent buyer lead (Sarah Jenkins) should be identified');
    assert.strictEqual(typeof buyerLead.name, 'string');
    assert.strictEqual(typeof buyerLead.handle, 'string');
    assert.strictEqual(typeof buyerLead.matchScore, 'number');
    assert.ok(buyerLead.matchScore >= 50, 'Buyer match score should be >= 50');
    assert.ok(buyerLead.matchReasoning.length > 0, 'Should include match reasoning');
    assert.ok(buyerLead.suggestedDm.length > 0, 'Should include suggested DM copy');

    // Verify self-promoter is not qualified
    const sellerLead = qualified.find((l) => l.handle.toLowerCase().includes('cheap_bots'));
    assert.strictEqual(sellerLead, undefined, 'Self-promoter/agency should be filtered out');

    // Verify coffee lover is not qualified
    const noiseLead = qualified.find((l) => l.handle.toLowerCase().includes('latte_life'));
    assert.strictEqual(noiseLead, undefined, 'Irrelevant noise tweet should be filtered out');
  });
});

describe('Gemini Conversational Chat Handler', () => {
  it('should return guidance message when messages is empty', async () => {
    const result = await chatWithGemini({ messages: [] });
    assert.ok(result && typeof result.reply === 'string');
    assert.ok(result.reply.length > 0);
  });

  it('should generate strategic advice for single string prompt', async () => {
    const result = await chatWithGemini({
      messages: 'Suggest 2 high-intent Twitter search queries for finding real estate agents needing lead follow-up automation.'
    });

    assert.ok(result && typeof result.reply === 'string');
    assert.ok(result.reply.length > 20, 'Reply should contain substantial strategic content');
  });

  it('should handle multi-turn conversational messages array', async () => {
    const messages = [
      { role: 'user', content: 'I build custom web scrapers for real estate.' },
      { role: 'model', content: 'That is a lucrative niche! Who do you want to target?' },
      { role: 'user', content: 'Give me 1 Boolean search syntax example for X.' }
    ];

    const result = await chatWithGemini({ messages });
    assert.ok(result && typeof result.reply === 'string');
    assert.ok(result.reply.length > 10);
  });

  it('should throw error when apiKey is empty string', async () => {
    await assert.rejects(
      async () => {
        await chatWithGemini({
          messages: 'Hello',
          apiKey: ''
        });
      },
      /Gemini API key is required/
    );
  });
});

describe('Server Endpoints Integration Tests', () => {
  let testServer;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      testServer = server.listen(0, () => {
        const address = testServer.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
  });

  it('GET /health should return 200 with service status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, {
      status: 'ok',
      service: 'X AI Automation Lead Finder'
    });
  });

  it('POST /api/chat should return 200 with AI reply', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: 'Name 3 industries with high demand for workflow automation.'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data && typeof data.reply === 'string');
    assert.ok(data.reply.length > 10);
  });

  it('POST /api/search-leads should return 400 when keywords is missing', async () => {
    const res = await fetch(`${baseUrl}/api/search-leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('keywords array is required'));
  });

  it('POST /api/search-leads should return 400 when keywords is empty array', async () => {
    const res = await fetch(`${baseUrl}/api/search-leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: [] })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });
});
