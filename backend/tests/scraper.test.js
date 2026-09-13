import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { chromium } from 'playwright';
import { scrapeXKeywords, extractTweetFromArticle } from '../src/scraper.js';

describe('Scraper Module Export and Input Validation', () => {
  it('should export scrapeXKeywords as a function', () => {
    assert.strictEqual(typeof scrapeXKeywords, 'function');
  });

  it('should export extractTweetFromArticle as a function', () => {
    assert.strictEqual(typeof extractTweetFromArticle, 'function');
  });

  it('should return empty array when keywords array is empty', async () => {
    const results = await scrapeXKeywords({ keywords: [] });
    assert.deepStrictEqual(results, []);
  });

  it('should return empty array when keywords is not provided', async () => {
    const results = await scrapeXKeywords({});
    assert.deepStrictEqual(results, []);
  });

  it('should return empty array when called with no arguments', async () => {
    const results = await scrapeXKeywords();
    assert.deepStrictEqual(results, []);
  });

  it('should return empty array when keywords is not an array', async () => {
    const results = await scrapeXKeywords({ keywords: null });
    assert.deepStrictEqual(results, []);
  });
});

describe('Scraper Error Handling', () => {
  it('should throw or reject when invalid browser options are provided', async () => {
    await assert.rejects(
      async () => {
        await scrapeXKeywords({
          keywords: ['ai automation'],
          launchOptions: { executablePath: 'C:\\non_existent_binary_path_for_testing.exe' }
        });
      },
      (err) => {
        assert.ok(err instanceof Error);
        return true;
      }
    );
  });
});

describe('extractTweetFromArticle DOM Parser Unit Test', () => {
  it('should extract tweet fields from a mock article element structure', () => {
    const mockArticle = {
      querySelector: (selector) => {
        if (selector === 'div[data-testid="User-Name"]') {
          return { innerText: 'Jane Doe\n@janedoe\n·\n1h' };
        }
        if (selector === 'div[data-testid="tweetText"]') {
          return { innerText: 'Looking for someone to build an AI automation workflow for my agency!' };
        }
        if (selector === 'time') {
          return { getAttribute: (attr) => (attr === 'datetime' ? '2026-09-13T08:00:00.000Z' : null) };
        }
        if (selector === 'a[href*="/status/"]') {
          return { getAttribute: (attr) => (attr === 'href' ? '/janedoe/status/1234567890' : null) };
        }
        if (selector === '[data-testid="like"]') {
          return { innerText: '1.2K' };
        }
        if (selector === '[data-testid="retweet"]') {
          return { innerText: '45' };
        }
        return null;
      }
    };

    const tweet = extractTweetFromArticle(mockArticle);

    assert.strictEqual(tweet.authorName, 'Jane Doe');
    assert.strictEqual(tweet.authorHandle, '@janedoe');
    assert.strictEqual(tweet.tweetText, 'Looking for someone to build an AI automation workflow for my agency!');
    assert.strictEqual(tweet.timestamp, '2026-09-13T08:00:00.000Z');
    assert.strictEqual(tweet.tweetUrl, 'https://x.com/janedoe/status/1234567890');
    assert.strictEqual(tweet.profileUrl, 'https://x.com/janedoe');
    assert.strictEqual(tweet.likes, 1200);
    assert.strictEqual(tweet.retweets, 45);
  });

  it('should handle missing elements safely without throwing', () => {
    const emptyArticle = {
      querySelector: () => null
    };

    const tweet = extractTweetFromArticle(emptyArticle);

    assert.strictEqual(tweet.authorName, 'Unknown');
    assert.strictEqual(tweet.authorHandle, '');
    assert.strictEqual(tweet.tweetText, '');
    assert.strictEqual(tweet.tweetUrl, '');
    assert.strictEqual(tweet.profileUrl, '');
    assert.strictEqual(tweet.likes, 0);
    assert.strictEqual(tweet.retweets, 0);
    assert.ok(tweet.timestamp);
  });
});

describe('Playwright Chromium Engine In-Browser Execution', () => {
  it('should launch headless Chromium and parse real DOM tweet articles', async () => {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <article data-testid="tweet">
            <div data-testid="User-Name">
              <span>Alex Rivera</span>
              <span>@alexrivera</span>
              <span>·</span>
              <span>2h</span>
            </div>
            <div data-testid="tweetText">We need an AI automation tool to scrape and generate qualified leads.</div>
            <time datetime="2026-09-13T09:00:00.000Z">2h</time>
            <a href="/alexrivera/status/987654321">Link</a>
            <div data-testid="like">350</div>
            <div data-testid="retweet">12</div>
          </article>
        </body>
        </html>
      `;

      await page.setContent(mockHtml);

      const parsedTweets = await page.evaluate(() => {
        const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        return articles.map(art => {
          const userEl = art.querySelector('div[data-testid="User-Name"]');
          const textEl = art.querySelector('div[data-testid="tweetText"]');
          const timeEl = art.querySelector('time');
          const linkEl = art.querySelector('a[href*="/status/"]');

          const rawUser = userEl ? userEl.innerText : '';
          const lines = rawUser.split('\n').map(s => s.trim()).filter(Boolean);
          const authorName = (lines[0] ? lines[0].split('@')[0].trim() : '') || 'Unknown';
          const handleMatch = rawUser.match(/@[\w_]+/);
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

      assert.strictEqual(parsedTweets.length, 1);
      assert.strictEqual(parsedTweets[0].authorName, 'Alex Rivera');
      assert.strictEqual(parsedTweets[0].authorHandle, '@alexrivera');
      assert.strictEqual(parsedTweets[0].tweetText, 'We need an AI automation tool to scrape and generate qualified leads.');
      assert.strictEqual(parsedTweets[0].tweetUrl, 'https://x.com/alexrivera/status/987654321');
      assert.strictEqual(parsedTweets[0].profileUrl, 'https://x.com/alexrivera');
    } finally {
      await browser.close();
    }
  });
});
