import { register } from 'node:module';

// Register mock loader for react-native BEFORE dynamically importing components
register('./loader.js', import.meta.url);

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import React from 'react';

// Dynamic imports so loader is fully registered first
const {
  DEFAULT_BACKEND_URL,
  LOCAL_BACKEND_URL,
  normalizeBackendUrl,
  checkServerHealth,
  sendChatMessage,
  triggerLeadSearch,
} = await import('../src/services/api.js');

const {
  getSocketInstance,
  subscribeToSearchProgress,
  disconnectSocket,
} = await import('../src/services/socket.js');

const {
  LeadCard,
  getScoreBadgeColors,
  formatHandle,
} = await import('../src/components/LeadCard.js');

const {
  ChatScreen,
  QUICK_PROMPTS,
  isLeadSearchPrompt,
  extractKeywordsFromPrompt,
  extractLeadCountFromPrompt,
  createChatMessage,
} = await import('../src/components/ChatScreen.js');

const { App } = await import('../App.js');

describe('1. API Service Unit & Integration Tests', () => {
  let testServer;
  let testBaseUrl;

  before(async () => {
    testServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', () => {
        if (req.url === '/health' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', service: 'X AI Automation Lead Finder' }));
        } else if (req.url === '/api/chat' && req.method === 'POST') {
          const parsed = JSON.parse(body || '{}');
          if (!parsed.messages) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'messages is required' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reply: 'AI Automation Niche Strategy: Real Estate & E-commerce.' }));
        } else if (req.url === '/api/search-leads' && req.method === 'POST') {
          const parsed = JSON.parse(body || '{}');
          if (!parsed.keywords || parsed.keywords.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'keywords array is required' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              totalScraped: 8,
              leads: [
                {
                  name: 'Sarah Jenkins',
                  handle: '@sarah_ops',
                  matchScore: 92,
                  matchReasoning: 'Needs workflow automation for Airtable and Slack',
                  tweetText: 'Looking for an AI chatbot developer to automate onboarding',
                  suggestedDm: 'Hey Sarah, saw your post regarding onboarding bottlenecks...',
                  profileUrl: 'https://x.com/sarah_ops',
                  tweetUrl: 'https://x.com/sarah_ops/status/123456789',
                },
              ],
            })
          );
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });
    });

    await new Promise((resolve) => {
      testServer.listen(0, '127.0.0.1', resolve);
    });
    const port = testServer.address().port;
    testBaseUrl = `http://127.0.0.1:${port}`;
  });

  after((done) => {
    disconnectSocket();
    testServer.close(done);
  });

  describe('normalizeBackendUrl', () => {
    it('should strip trailing slashes from URL', () => {
      assert.strictEqual(
        normalizeBackendUrl('https://example.com/api///'),
        'https://example.com/api'
      );
    });

    it('should return default URL when input is empty or null', () => {
      assert.strictEqual(normalizeBackendUrl(''), DEFAULT_BACKEND_URL);
      assert.strictEqual(normalizeBackendUrl(null), DEFAULT_BACKEND_URL);
      assert.strictEqual(normalizeBackendUrl(undefined), DEFAULT_BACKEND_URL);
    });

    it('should preserve valid standard URLs', () => {
      assert.strictEqual(normalizeBackendUrl(LOCAL_BACKEND_URL), LOCAL_BACKEND_URL);
    });
  });

  describe('checkServerHealth', () => {
    it('should return connected true for responsive endpoint', async () => {
      const health = await checkServerHealth({ backendUrl: testBaseUrl });
      assert.strictEqual(health.connected, true);
      assert.strictEqual(health.data.status, 'ok');
      assert.strictEqual(health.url, testBaseUrl);
    });

    it('should return connected false with error for unreachable endpoint', async () => {
      const health = await checkServerHealth({ backendUrl: 'http://127.0.0.1:59999' });
      assert.strictEqual(health.connected, false);
      assert.ok(health.error);
    });
  });

  describe('sendChatMessage', () => {
    it('should reject when messages is empty', async () => {
      await assert.rejects(
        () => sendChatMessage({ messages: [], backendUrl: testBaseUrl }),
        /Messages cannot be empty/
      );
    });

    it('should send string prompt formatted as single user message', async () => {
      const response = await sendChatMessage({
        messages: 'Suggest top niches for AI automation',
        backendUrl: testBaseUrl,
      });
      assert.ok(response.reply);
      assert.match(response.reply, /AI Automation Niche Strategy/);
    });

    it('should send multi-turn messages array', async () => {
      const response = await sendChatMessage({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'model', content: 'Hi there' },
          { role: 'user', content: 'Give me keywords' },
        ],
        backendUrl: testBaseUrl,
      });
      assert.ok(response.reply);
    });
  });

  describe('triggerLeadSearch', () => {
    it('should reject when keywords array is missing or empty', async () => {
      await assert.rejects(
        () => triggerLeadSearch({ keywords: [], backendUrl: testBaseUrl }),
        /Keywords must be a non-empty array/
      );
      await assert.rejects(
        () => triggerLeadSearch({ keywords: null, backendUrl: testBaseUrl }),
        /Keywords must be a non-empty array/
      );
    });

    it('should trigger lead search and return qualified leads', async () => {
      const result = await triggerLeadSearch({
        keywords: ['need ai chatbot', 'looking for automation'],
        maxLeadsPerKeyword: 5,
        criteria: 'High budget clients',
        backendUrl: testBaseUrl,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.totalScraped, 8);
      assert.strictEqual(result.leads.length, 1);
      assert.strictEqual(result.leads[0].handle, '@sarah_ops');
      assert.strictEqual(result.leads[0].matchScore, 92);
    });
  });
});

describe('2. Socket.IO Service Tests', () => {
  after(() => {
    disconnectSocket();
  });

  it('should initialize and return socket instance', () => {
    const socket = getSocketInstance('http://localhost:10000');
    assert.ok(socket);
    assert.strictEqual(typeof socket.on, 'function');
  });

  it('should support subscribeToSearchProgress and return cleanup function', () => {
    let captured = null;
    const cleanup = subscribeToSearchProgress((data) => {
      captured = data;
    }, 'http://localhost:10000');

    assert.strictEqual(typeof cleanup, 'function');
    cleanup();
  });

  it('should disconnect cleanly without throwing', () => {
    assert.doesNotThrow(() => {
      disconnectSocket();
    });
  });
});

describe('3. LeadCard Component & Helpers Tests', () => {
  describe('getScoreBadgeColors', () => {
    it('should return High Intent tokens for scores >= 85', () => {
      const colors = getScoreBadgeColors(95);
      assert.strictEqual(colors.label, 'High Intent');
      assert.strictEqual(colors.text, '#34d399');
    });

    it('should return Good Match tokens for scores between 70 and 84', () => {
      const colors = getScoreBadgeColors(75);
      assert.strictEqual(colors.label, 'Good Match');
      assert.strictEqual(colors.text, '#38bdf8');
    });

    it('should return Moderate tokens for scores between 50 and 69', () => {
      const colors = getScoreBadgeColors(60);
      assert.strictEqual(colors.label, 'Moderate');
      assert.strictEqual(colors.text, '#fbbf24');
    });

    it('should return Low Intent tokens for scores < 50', () => {
      const colors = getScoreBadgeColors(40);
      assert.strictEqual(colors.label, 'Low Intent');
      assert.strictEqual(colors.text, '#fb7185');
    });
  });

  describe('formatHandle', () => {
    it('should add @ prefix if missing', () => {
      assert.strictEqual(formatHandle('john_doe'), '@john_doe');
    });

    it('should preserve handle if @ already present', () => {
      assert.strictEqual(formatHandle('@john_doe'), '@john_doe');
    });

    it('should return @unknown for null or empty input', () => {
      assert.strictEqual(formatHandle(''), '@unknown');
      assert.strictEqual(formatHandle(null), '@unknown');
    });
  });

  describe('LeadCard Component Render', () => {
    it('should export LeadCard as a function', () => {
      assert.strictEqual(typeof LeadCard, 'function');
    });

    it('should create valid React element tree with lead props', () => {
      const mockLead = {
        name: 'Sarah Jenkins',
        handle: '@sarah_ops',
        matchScore: 95,
        matchReasoning: 'Explicit operational bottleneck in agency onboarding',
        tweetText: 'We spend 15 hours a week copying data between Airtable and Slack.',
        suggestedDm: 'Hey Sarah, saw your onboarding bottlenecks post...',
        profileUrl: 'https://x.com/sarah_ops',
        tweetUrl: 'https://x.com/sarah_ops/status/123456789',
      };

      const element = React.createElement(LeadCard, { lead: mockLead });
      assert.ok(element);
      assert.strictEqual(element.type, LeadCard);
      assert.deepStrictEqual(element.props.lead, mockLead);

      const rendered = LeadCard({ lead: mockLead });
      assert.ok(rendered);
      assert.strictEqual(rendered.type, 'View');
      assert.strictEqual(rendered.props.testID, 'lead-card');
    });

    it('should handle missing or partial lead data gracefully', () => {
      const rendered = LeadCard({ lead: {} });
      assert.ok(rendered);
      assert.strictEqual(rendered.type, 'View');
    });
  });
});

describe('4. ChatScreen Component & Prompt Helpers Tests', () => {
  describe('QUICK_PROMPTS', () => {
    it('should define the 3 specified prompt chips', () => {
      assert.strictEqual(QUICK_PROMPTS.length, 3);
      assert.strictEqual(QUICK_PROMPTS[0], 'Suggest top niches for AI automation');
      assert.strictEqual(QUICK_PROMPTS[1], 'Suggest X search keywords for real estate AI');
      assert.strictEqual(
        QUICK_PROMPTS[2],
        "Search X for keywords 'need ai chatbot', 'looking for automation' (find 5 leads)"
      );
    });
  });

  describe('isLeadSearchPrompt', () => {
    it('should identify search X prompts', () => {
      assert.strictEqual(
        isLeadSearchPrompt("Search X for keywords 'need ai chatbot'"),
        true
      );
      assert.strictEqual(isLeadSearchPrompt('scrape x for automation'), true);
      assert.strictEqual(isLeadSearchPrompt('find leads for real estate'), true);
    });

    it('should return false for regular conversational prompts', () => {
      assert.strictEqual(
        isLeadSearchPrompt('Suggest top niches for AI automation'),
        false
      );
      assert.strictEqual(
        isLeadSearchPrompt('What is the best way to do cold outreach?'),
        false
      );
    });
  });

  describe('extractKeywordsFromPrompt', () => {
    it('should extract quoted keywords', () => {
      const keywords = extractKeywordsFromPrompt(
        "Search X for keywords 'need ai chatbot', 'looking for automation' (find 5 leads)"
      );
      assert.deepStrictEqual(keywords, ['need ai chatbot', 'looking for automation']);
    });

    it('should extract double-quoted keywords', () => {
      const keywords = extractKeywordsFromPrompt(
        'search x for "real estate ai", "property automation"'
      );
      assert.deepStrictEqual(keywords, ['real estate ai', 'property automation']);
    });

    it('should fallback to defaults when no quotes found', () => {
      const keywords = extractKeywordsFromPrompt('Search X for leads');
      assert.ok(Array.isArray(keywords));
      assert.ok(keywords.length > 0);
    });
  });

  describe('extractLeadCountFromPrompt', () => {
    it('should extract lead count when specified in prompt', () => {
      assert.strictEqual(
        extractLeadCountFromPrompt('Search X for keywords (find 5 leads)'),
        5
      );
      assert.strictEqual(
        extractLeadCountFromPrompt('get 10 leads for real estate'),
        10
      );
    });

    it('should default to 5 leads if count not specified', () => {
      assert.strictEqual(
        extractLeadCountFromPrompt('Search X for keywords'),
        5
      );
    });
  });

  describe('createChatMessage', () => {
    it('should format message object with unique id and timestamp', () => {
      const msg = createChatMessage('user', 'Hello world');
      assert.ok(msg.id);
      assert.strictEqual(msg.role, 'user');
      assert.strictEqual(msg.content, 'Hello world');
      assert.ok(msg.timestamp);
    });

    it('should include optional extras such as qualified leads', () => {
      const msg = createChatMessage('assistant', 'Here are your leads', {
        leads: [{ name: 'Test' }],
        totalScraped: 10,
      });
      assert.strictEqual(msg.leads.length, 1);
      assert.strictEqual(msg.totalScraped, 10);
    });
  });

  describe('ChatScreen Component Export', () => {
    it('should export ChatScreen as a function', () => {
      assert.strictEqual(typeof ChatScreen, 'function');
    });

    it('should create valid ChatScreen React element', () => {
      const el = React.createElement(ChatScreen, {
        backendUrl: 'https://x-ai-lead-finder-backend.onrender.com',
      });
      assert.ok(el);
      assert.strictEqual(el.type, ChatScreen);
    });
  });
});

describe('5. App Root Component Tests', () => {
  it('should export App as a function', () => {
    assert.strictEqual(typeof App, 'function');
  });

  it('should create valid App React element', () => {
    const el = React.createElement(App);
    assert.ok(el);
    assert.strictEqual(el.type, App);
  });
});
