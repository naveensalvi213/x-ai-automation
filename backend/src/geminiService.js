import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export const DEFAULT_GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || 'AQ.Ab8RN6JvkY_4jiC_fzmBr7xtDhOBUYNh2qD7UUHbox3EriGcNA';

/**
 * Robust JSON parser for LLM responses, stripping code fences and extracting JSON structures.
 * @param {string} rawText - Raw text response from Gemini
 * @returns {any} - Parsed JSON object or array
 */
export function parseGeminiJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }
  let cleaned = rawText.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt regex extraction of JSON array
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (_) {}
    }
    // Attempt regex extraction of JSON object
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (_) {}
    }
    throw new Error(`Failed to parse Gemini JSON output: ${err.message}. Raw output preview: ${rawText.slice(0, 150)}`);
  }
}

/**
 * Evaluates scraped tweets using Gemini to filter spam/sellers and identify high-intent buyer leads.
 * 
 * @param {object} options
 * @param {Array<object>} options.tweets - Array of scraped tweet objects
 * @param {string} [options.userCriteria] - Optional custom criteria to filter/rank leads
 * @param {string} [options.apiKey] - Google Gemini API Key
 * @param {string} [options.modelName='gemini-2.5-flash'] - Gemini model to use
 * @returns {Promise<Array<object>>} - Array of structured lead objects
 */
export async function qualifyLeadsWithGemini({
  tweets = [],
  userCriteria = '',
  apiKey,
  modelName = 'gemini-2.5-flash'
} = {}) {
  if (!Array.isArray(tweets) || tweets.length === 0) {
    return [];
  }

  const effectiveApiKey = apiKey !== undefined ? apiKey : DEFAULT_GEMINI_API_KEY;
  if (!effectiveApiKey || typeof effectiveApiKey !== 'string' || effectiveApiKey.trim() === '') {
    throw new Error('Gemini API key is required for lead qualification');
  }

  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

  const criteriaSection = userCriteria && userCriteria.trim()
    ? `SPECIFIC USER TARGETING CRITERIA: "${userCriteria.trim()}"`
    : 'DEFAULT TARGETING CRITERIA: Business owners, founders, creators, e-commerce sellers, agencies, or teams expressing explicit or implicit demand for AI automation, custom chatbots, web scrapers, data pipelines, workflow automation (Zapier/Make/n8n), or AI agents.';

  const prompt = `You are an elite B2B Lead Qualification and Cold Outreach Specialist.
Your mission is to analyze a batch of scraped tweets from X (Twitter) and rigorously qualify real prospective BUYERS and CLIENTS for AI automation services.

EVALUATION CRITERIA:
1. FILTER OUT / DISQUALIFY:
   - Spam, bot gibberish, crypto/airdrop scams, giveaways.
   - Self-promoters, competitors, and agencies advertising their own services (e.g. "We build chatbots, DM me", "Check out my new AI SaaS", "I automate workflows for $500").
   - Generic news headlines, memes, tech announcements, or academic talk without problem-solving intent.
2. QUALIFY HIGH-INTENT BUYERS:
   - Tweets asking for recommendations (e.g. "What tool can scrape...", "Looking for a chatbot that...", "Can anyone recommend an automation for...").
   - Tweets expressing frustration with manual, repetitive, or painful business operations (e.g. "Spending 3 hours a day copying data...", "Customer support inbox is overwhelming").
   - Tweets seeking to hire contractors, developers, or agencies (e.g. "Need someone to build a scraper", "Hiring n8n expert").
   - Tweets questioning feasibility (e.g. "Is it possible to automate...", "Can an AI agent handle...").
3. ${criteriaSection}

4. SCORING GUIDELINE (matchScore: integer between 0 and 100):
   - 80-100: Very high intent (active buyer, budget or urgent need mentioned).
   - 60-79: Strong intent (clear operational friction or direct question about solutions).
   - 50-59: Moderate potential (viable problem, open to automation).
   - Below 50: Disqualify completely (do not include in response).

5. OUTREACH DM (suggestedDm):
   - Write a compelling, natural, non-salesy direct message (1-3 sentences).
   - Acknowledge their exact tweet/problem and offer value or relevant insight without sounding like a generic bot.

INPUT TWEETS:
${JSON.stringify(
  tweets.map((t, idx) => ({
    index: idx + 1,
    name: t.authorName || t.name || 'Unknown',
    handle: t.authorHandle || t.handle || '',
    profileUrl: t.profileUrl || (t.authorHandle ? `https://x.com/${t.authorHandle.replace('@', '')}` : ''),
    tweetUrl: t.tweetUrl || '',
    tweetText: t.tweetText || t.text || ''
  })),
  null,
  2
)}

OUTPUT SPECIFICATION:
Respond with a strict JSON array of qualified lead objects, sorted by matchScore descending:
[
  {
    "name": "Full Name",
    "handle": "@handle",
    "profileUrl": "https://x.com/handle",
    "tweetUrl": "https://x.com/handle/status/123456",
    "tweetText": "Original tweet content",
    "matchScore": 85,
    "matchReasoning": "Concise 1-2 sentence explanation of why this prospect is a qualified buyer.",
    "suggestedDm": "Hey [Name], saw your tweet about [problem]. We built a workflow that solves this exact bottleneck. Happy to share our approach if helpful!"
  }
]
If none of the tweets qualify, respond with an empty array [].`;

  try {
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        attempts++;
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        });
        break;
      } catch (err) {
        if ((err.status === 429 || err.message?.includes('429')) && attempts < maxAttempts) {
          console.warn(`Gemini rate limited (429), retrying in ${attempts * 2}s (attempt ${attempts}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, attempts * 2000));
        } else {
          throw err;
        }
      }
    }

    const parsed = parseGeminiJsonResponse(response.text);
    if (!Array.isArray(parsed)) {
      console.warn('Gemini qualification did not return a JSON array:', parsed);
      return [];
    }

    // Standardize lead shape and fallback to original tweet attributes if missing
    return parsed.map((lead) => {
      const handle = lead.handle
        ? (lead.handle.startsWith('@') ? lead.handle : `@${lead.handle}`)
        : '';
      const profileUrl = lead.profileUrl || (handle ? `https://x.com/${handle.replace('@', '')}` : '');

      return {
        name: lead.name || 'Prospect',
        handle,
        profileUrl,
        tweetUrl: lead.tweetUrl || '',
        tweetText: lead.tweetText || '',
        matchScore: typeof lead.matchScore === 'number' ? Math.round(lead.matchScore) : 70,
        matchReasoning: lead.matchReasoning || 'Identified as prospective buyer for AI automation solutions.',
        suggestedDm: lead.suggestedDm || ''
      };
    });
  } catch (error) {
    console.error('Error in qualifyLeadsWithGemini:', error.message);
    throw error;
  }
}

/**
 * Conversational AI handler for niche suggestions, keyword ideas, and lead generation advice.
 * 
 * @param {object} options
 * @param {Array<object>|string} options.messages - Array of chat messages or prompt string
 * @param {string} [options.apiKey] - Google Gemini API Key
 * @param {string} [options.modelName='gemini-2.5-flash'] - Gemini model
 * @returns {Promise<{ reply: string }>}
 */
export async function chatWithGemini({
  messages,
  apiKey,
  modelName = 'gemini-2.5-flash'
} = {}) {
  const effectiveApiKey = apiKey !== undefined ? apiKey : DEFAULT_GEMINI_API_KEY;
  if (!effectiveApiKey || typeof effectiveApiKey !== 'string' || effectiveApiKey.trim() === '') {
    throw new Error('Gemini API key is required for chat');
  }

  const ai = new GoogleGenAI({ apiKey: effectiveApiKey });

  const systemInstruction = `You are the ultimate AI Automation Lead Generation Expert & Growth Strategist.
You advise agency owners, freelance developers, and solopreneurs on acquiring high-paying clients on X (Twitter) for AI automation, web scrapers, chatbots, and workflow automation.

Your areas of expertise:
1. High-converting X (Twitter) search queries and Boolean operators (e.g. quotes, negative keywords, "recommendations", "how to automate").
2. Lucrative niches needing automation (e.g. real estate lead intake, e-commerce price monitoring, CRM sync, cold outreach scraping, customer support bots).
3. Personalized cold outreach direct message (DM) scripts that deliver upfront value and earn replies.
4. Lead qualification criteria, pricing strategies, and proposal advice.

Guidelines:
- Keep advice practical, actionable, and formatted with clean markdown bullets or numbered steps.
- When suggesting Twitter search keywords, include exact syntax and explain the intent behind each query.`;

  // Normalize incoming messages
  let contents = [];
  if (typeof messages === 'string') {
    contents = [{ role: 'user', parts: [{ text: messages }] }];
  } else if (Array.isArray(messages) && messages.length > 0) {
    contents = messages.map((m) => {
      const role = (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user';
      const text = m.content || m.text || m.message || (typeof m === 'string' ? m : '');
      return {
        role,
        parts: [{ text: String(text) }]
      };
    }).filter((c) => c.parts[0].text.trim().length > 0);
  }

  if (contents.length === 0) {
    return {
      reply: 'Hello! I am your AI Lead Generation strategist. Ask me for high-intent search keywords, niche ideas, or cold outreach DM templates for X (Twitter).'
    };
  }

  try {
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        attempts++;
        response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7
          }
        });
        break;
      } catch (err) {
        if ((err.status === 429 || err.message?.includes('429')) && attempts < maxAttempts) {
          console.warn(`Gemini rate limited (429), retrying in ${attempts * 2}s (attempt ${attempts}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, attempts * 2000));
        } else {
          throw err;
        }
      }
    }

    const reply = response ? (response.text || '') : '';
    return { reply };
  } catch (error) {
    console.error('Error in chatWithGemini:', error.message);
    throw error;
  }
}
