import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { sendChatMessage, triggerLeadSearch, DEFAULT_BACKEND_URL } from '../services/api.js';
import { subscribeToSearchProgress } from '../services/socket.js';
import LeadCard from './LeadCard.js';

export const QUICK_PROMPTS = [
  'Suggest top niches for AI automation',
  'Suggest X search keywords for real estate AI',
  "Search X for keywords 'need ai chatbot', 'looking for automation' (find 5 leads)",
];

/**
 * Detects if a prompt is explicitly asking to trigger a live X search
 */
export function isLeadSearchPrompt(prompt = '') {
  const lower = prompt.toLowerCase();
  return (
    lower.startsWith('search x') ||
    lower.includes('scrape x') ||
    lower.includes('find leads') ||
    lower.includes('search leads')
  );
}

/**
 * Extracts keyword list and optional lead count from search prompt
 */
export function extractKeywordsFromPrompt(prompt = '') {
  // Check for quoted strings: 'kw1', 'kw2' or "kw1", "kw2"
  const quoted = prompt.match(/['"]([^'"]+)['"]/g);
  if (quoted && quoted.length > 0) {
    const cleaned = quoted.map((k) => k.replace(/['"]/g, '').trim()).filter(Boolean);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  // Fallback defaults for common automation lead searches
  return ['need ai chatbot', 'looking for automation'];
}

/**
 * Extracts max leads number if specified in prompt (e.g. "find 5 leads")
 */
export function extractLeadCountFromPrompt(prompt = '') {
  const match = prompt.match(/(?:find|get|max|top)\s+(\d+)\s+leads?/i);
  if (match && match[1]) {
    const count = parseInt(match[1], 10);
    return count > 0 && count <= 20 ? count : 5;
  }
  return 5;
}

/**
 * Formats a message object for state tracking
 */
export function createChatMessage(role, content, extras = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    role,
    content,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ...extras,
  };
}

/**
 * Chat Screen Component with ChatGPT/Gemini interface, chips, and live lead results
 */
export function ChatScreen({ backendUrl = DEFAULT_BACKEND_URL, onStatusChange }) {
  const [messages, setMessages] = useState([
    createChatMessage(
      'assistant',
      "👋 Welcome to X AI Lead Finder!\n\nI can brainstorm high-converting niches, formulate high-intent search keywords, or run live Playwright browser scraping on X with Gemini AI buyer qualification.\n\nTap a quick prompt chip below or type your request."
    ),
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchProgress, setSearchProgress] = useState(null);
  const scrollViewRef = useRef(null);

  // Subscribe to real-time Playwright scraping and qualification socket events
  useEffect(() => {
    const unsubscribe = subscribeToSearchProgress((data) => {
      setSearchProgress(data);
      if (typeof onStatusChange === 'function') {
        onStatusChange(data?.message || 'Processing live lead search...');
      }
    }, backendUrl);

    return () => {
      unsubscribe();
    };
  }, [backendUrl, onStatusChange]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollViewRef.current?.scrollToEnd) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    setInputText('');
    const userMsg = createChatMessage('user', query);
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);
    scrollToBottom();

    // Check if user requested a live lead search
    if (isLeadSearchPrompt(query)) {
      const keywords = extractKeywordsFromPrompt(query);
      const maxLeads = extractLeadCountFromPrompt(query);

      setSearchProgress({
        status: 'scraping',
        message: `Launching Playwright browser on Render for keywords: ${keywords.map((k) => `"${k}"`).join(', ')}...`,
      });

      try {
        const result = await triggerLeadSearch({
          keywords,
          maxLeadsPerKeyword: maxLeads,
          criteria: 'Businesses or operators looking for AI chatbot, automation, or custom software solutions',
          backendUrl,
        });

        const qualifiedCount = result?.leads?.length || 0;
        const totalScraped = result?.totalScraped || 0;

        const summaryText = qualifiedCount > 0
          ? `🎯 Scraped ${totalScraped} tweets across ${keywords.length} keywords. Qualified ${qualifiedCount} high-intent buyer leads with personalized outreach DMs:`
          : `⚠️ Scraped ${totalScraped} tweets, but none met the minimum 50% buyer intent threshold. Try broader keywords or adjust search terms.`;

        const assistantMsg = createChatMessage('assistant', summaryText, {
          leads: result?.leads || [],
          totalScraped,
        });

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg = createChatMessage(
          'assistant',
          `❌ Lead search failed: ${err.message}\n\nPlease check your backend URL and Render service logs.`
        );
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
        setSearchProgress(null);
        scrollToBottom();
      }
    } else {
      // Conversational Gemini Strategy Chat
      try {
        const chatPayload = updatedMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          content: m.content,
        }));

        const result = await sendChatMessage({
          messages: chatPayload,
          backendUrl,
        });

        const assistantMsg = createChatMessage('assistant', result.reply || 'No reply received from Gemini.');
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg = createChatMessage(
          'assistant',
          `❌ AI Chat Error: ${err.message}\n\nPlease verify backend connectivity at ${backendUrl}.`
        );
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
        scrollToBottom();
      }
    }
  };

  return React.createElement(
    KeyboardAvoidingView,
    {
      style: styles.container,
      behavior: Platform.OS === 'ios' ? 'padding' : undefined,
      keyboardVerticalOffset: 90,
      testID: 'chat-screen',
    },
    // Message List Feed
    React.createElement(
      ScrollView,
      {
        ref: scrollViewRef,
        style: styles.messagesContainer,
        contentContainerStyle: styles.messagesContent,
        onContentSizeChange: scrollToBottom,
        testID: 'messages-scroll',
      },
      // Render Messages
      messages.map((msg) => {
        const isUser = msg.role === 'user';
        return React.createElement(
          View,
          {
            key: msg.id,
            style: [
              styles.messageRow,
              isUser ? styles.userRow : styles.assistantRow,
            ],
          },
          React.createElement(
            View,
            {
              style: [
                styles.bubble,
                isUser ? styles.userBubble : styles.assistantBubble,
              ],
              testID: `chat-bubble-${msg.role}`,
            },
            React.createElement(
              Text,
              { style: styles.senderLabel },
              isUser ? 'You' : 'Gemini AI Lead Consultant'
            ),
            React.createElement(
              Text,
              { style: [styles.messageText, isUser ? styles.userText : styles.assistantText] },
              msg.content
            ),
            // If message contains qualified leads, render LeadCards
            msg.leads && msg.leads.length > 0
              ? React.createElement(
                  View,
                  { style: styles.leadsFeed, testID: 'leads-feed' },
                  msg.leads.map((lead, idx) =>
                    React.createElement(LeadCard, {
                      key: `lead-${lead.handle || idx}-${idx}`,
                      lead,
                    })
                  )
                )
              : null,
            React.createElement(
              Text,
              { style: styles.timestampText },
              msg.timestamp
            )
          )
        );
      }),

      // Live Scraper Progress Banner (When Playwright auto-scrolls on Render)
      searchProgress
        ? React.createElement(
            View,
            { style: styles.progressCard, testID: 'live-progress-banner' },
            React.createElement(
              View,
              { style: styles.progressHeader },
              React.createElement(ActivityIndicator, {
                size: 'small',
                color: '#38bdf8',
              }),
              React.createElement(
                Text,
                { style: styles.progressTitle },
                `LIVE PLAYWRIGHT SCRAPER: ${(searchProgress.status || 'BUSY').toUpperCase()}`
              )
            ),
            React.createElement(
              Text,
              { style: styles.progressDetail },
              searchProgress.message || 'Auto-scrolling X search feeds...'
            )
          )
        : null,

      // Loading Spinner when waiting for AI chat reply
      isLoading && !searchProgress
        ? React.createElement(
            View,
            { style: styles.loadingRow, testID: 'loading-indicator' },
            React.createElement(ActivityIndicator, { size: 'small', color: '#38bdf8' }),
            React.createElement(
              Text,
              { style: styles.loadingText },
              'Gemini is thinking...'
            )
          )
        : null
    ),

    // Quick Action Prompt Chips (Horizontal Carousel)
    React.createElement(
      View,
      { style: styles.chipsWrapper },
      React.createElement(
        ScrollView,
        {
          horizontal: true,
          showsHorizontalScrollIndicator: false,
          contentContainerStyle: styles.chipsContainer,
          testID: 'quick-chips',
        },
        QUICK_PROMPTS.map((chip, idx) =>
          React.createElement(
            TouchableOpacity,
            {
              key: `chip-${idx}`,
              style: styles.chipButton,
              onPress: () => handleSendMessage(chip),
              disabled: isLoading,
              activeOpacity: 0.7,
              testID: `quick-chip-${idx}`,
            },
            React.createElement(
              Text,
              { style: styles.chipText, numberOfLines: 1 },
              chip
            )
          )
        )
      )
    ),

    // Chat Input Bar
    React.createElement(
      View,
      { style: styles.inputBar, testID: 'chat-input-bar' },
      React.createElement(TextInput, {
        style: styles.textInput,
        placeholder: "Ask Gemini or type 'Search X for ...'",
        placeholderTextColor: '#64748b',
        value: inputText,
        onChangeText: setInputText,
        onSubmitEditing: () => handleSendMessage(),
        editable: !isLoading,
        multiline: false,
        testID: 'chat-input',
      }),
      React.createElement(
        TouchableOpacity,
        {
          style: [
            styles.sendButton,
            (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
          ],
          onPress: () => handleSendMessage(),
          disabled: !inputText.trim() || isLoading,
          activeOpacity: 0.7,
          testID: 'send-button',
        },
        React.createElement(
          Text,
          { style: styles.sendButtonText },
          isLoading ? '...' : 'Send'
        )
      )
    )
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 24,
  },
  messageRow: {
    marginVertical: 6,
    flexDirection: 'row',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '92%',
    borderRadius: 16,
    padding: 14,
  },
  userBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#161e2e',
    borderColor: '#243049',
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
  },
  userText: {
    color: '#ffffff',
  },
  assistantText: {
    color: '#f1f5f9',
  },
  timestampText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  leadsFeed: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  progressCard: {
    backgroundColor: '#0f172a',
    borderColor: '#0284c7',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.8,
  },
  progressDetail: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 18,
    marginLeft: 26,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  chipsWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0c111d',
    paddingVertical: 8,
  },
  chipsContainer: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chipButton: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0c111d',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#161f30',
    borderColor: '#283548',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#0284c7',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#1e293b',
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default ChatScreen;
