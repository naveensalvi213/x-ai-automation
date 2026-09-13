import axios from 'axios';

export const DEFAULT_BACKEND_URL = 'https://x-ai-lead-finder-backend.onrender.com';
export const LOCAL_BACKEND_URL = 'http://localhost:10000';

/**
 * Normalizes backend URL by stripping trailing slashes
 */
export function normalizeBackendUrl(url) {
  if (!url || typeof url !== 'string') {
    return DEFAULT_BACKEND_URL;
  }
  return url.trim().replace(/\/+$/, '');
}

/**
 * Checks connectivity and health of the backend server
 */
export async function checkServerHealth({ backendUrl = DEFAULT_BACKEND_URL } = {}) {
  const baseUrl = normalizeBackendUrl(backendUrl);
  try {
    const response = await axios.get(`${baseUrl}/health`, { timeout: 8000 });
    return {
      connected: true,
      data: response.data,
      url: baseUrl,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.response?.data?.error || error.message,
      url: baseUrl,
    };
  }
}

/**
 * Sends messages array or prompt string to Gemini AI chat endpoint
 */
export async function sendChatMessage({ messages, backendUrl = DEFAULT_BACKEND_URL, apiKey } = {}) {
  const baseUrl = normalizeBackendUrl(backendUrl);

  if (!messages || (Array.isArray(messages) && messages.length === 0)) {
    throw new Error('Messages cannot be empty');
  }

  // Normalize to backend format: array of { role, content } or pass string
  const payload = {
    messages: typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages,
  };
  if (apiKey) {
    payload.apiKey = apiKey;
  }

  try {
    const response = await axios.post(`${baseUrl}/api/chat`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.error || error.message || 'Chat request failed';
    throw new Error(`AI Chat error: ${message}`);
  }
}

/**
 * Triggers Playwright live scraping and Gemini lead qualification
 */
export async function triggerLeadSearch({
  keywords,
  maxLeadsPerKeyword = 5,
  criteria = '',
  backendUrl = DEFAULT_BACKEND_URL,
  authToken,
  apiKey,
} = {}) {
  const baseUrl = normalizeBackendUrl(backendUrl);

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    throw new Error('Keywords must be a non-empty array of search terms');
  }

  const payload = {
    keywords,
    maxLeadsPerKeyword: Number(maxLeadsPerKeyword) || 5,
    criteria: criteria || undefined,
  };
  if (authToken) payload.authToken = authToken;
  if (apiKey) payload.apiKey = apiKey;

  try {
    const response = await axios.post(`${baseUrl}/api/search-leads`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 180000, // Long timeout for real Playwright scrolling & AI qualification
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.error || error.message || 'Lead search failed';
    throw new Error(`Lead search error: ${message}`);
  }
}
