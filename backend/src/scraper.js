import { chromium } from 'playwright';

/**
 * Parses tweet details from a DOM article node within page.evaluate.
 * @param {Element} art
 * @returns {object}
 */
export function extractTweetFromArticle(art) {
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

  // Extract metrics if available
  const likeEl = art.querySelector('[data-testid="like"]');
  const retweetEl = art.querySelector('[data-testid="retweet"]');
  
  const parseMetric = (el) => {
    if (!el) return 0;
    const text = el.innerText?.trim() || '';
    if (!text) return 0;
    if (text.endsWith('K') || text.endsWith('k')) return parseFloat(text) * 1000;
    if (text.endsWith('M') || text.endsWith('m')) return parseFloat(text) * 1000000;
    return parseInt(text.replace(/,/g, ''), 10) || 0;
  };

  const likes = parseMetric(likeEl);
  const retweets = parseMetric(retweetEl);

  return {
    authorName,
    authorHandle,
    bio: '',
    tweetText,
    timestamp,
    tweetUrl: tweetPath ? `https://x.com${tweetPath}` : '',
    profileUrl: authorHandle ? `https://x.com/${authorHandle.replace('@', '')}` : '',
    likes,
    retweets
  };
}

/**
 * Scrapes tweets from X (Twitter) for specified keywords across Latest and Top tabs.
 * 
 * @param {object} options
 * @param {string[]} options.keywords - Array of keyword search terms
 * @param {number} [options.maxLeadsPerKeyword=10] - Max leads per keyword to extract
 * @param {string} [options.authToken] - auth_token cookie value for X.com
 * @param {object} [options.launchOptions] - Optional Playwright launch overrides
 * @returns {Promise<Array<object>>} - Array of scraped tweet objects
 */
export async function scrapeXKeywords({
  keywords = [],
  maxLeadsPerKeyword = 10,
  authToken,
  launchOptions = {}
} = {}) {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return [];
  }

  let browser;
  const allResults = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      ...launchOptions
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    if (authToken) {
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
    }

    const page = await context.newPage();

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
          const maxScrollAttempts = 10;

          while (scrapedCount < maxLeadsPerKeyword && scrollAttempts < maxScrollAttempts) {
            const tweets = await page.evaluate(() => {
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

                const likeEl = art.querySelector('[data-testid="like"]');
                const retweetEl = art.querySelector('[data-testid="retweet"]');
                
                const parseMetric = (el) => {
                  if (!el) return 0;
                  const text = el.innerText?.trim() || '';
                  if (!text) return 0;
                  if (text.endsWith('K') || text.endsWith('k')) return parseFloat(text) * 1000;
                  if (text.endsWith('M') || text.endsWith('m')) return parseFloat(text) * 1000000;
                  return parseInt(text.replace(/,/g, ''), 10) || 0;
                };

                return {
                  authorName,
                  authorHandle,
                  bio: '',
                  tweetText,
                  timestamp,
                  tweetUrl: tweetPath ? `https://x.com${tweetPath}` : '',
                  profileUrl: authorHandle ? `https://x.com/${authorHandle.replace('@', '')}` : '',
                  likes: parseMetric(likeEl),
                  retweets: parseMetric(retweetEl)
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
          console.error(`Error scraping "${kw}" on ${tab.name} tab:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Fatal scraper error:', err.message);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return allResults;
}
