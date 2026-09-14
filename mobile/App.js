import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  StyleSheet,
  StatusBar,
  Share,
  Clipboard,
  Alert,
} from 'react-native';

export default function App() {
  const [keywords, setKeywords] = useState('need chatbot, hire developer, web scraper, AI automation');
  const [scrollDepth, setScrollDepth] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [posts, setPosts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [activeTab, setActiveTab] = useState('leads'); // 'leads' | 'all'
  const [backendUrl, setBackendUrl] = useState('http://10.222.207.88:5000');
  const [showSettings, setShowSettings] = useState(false);

  const presets = [
    'need chatbot, hire developer',
    'web scraper, AI automation',
    'looking for ai developer',
    'need n8n developer, build bot',
  ];

  const handleStartScrape = async () => {
    if (!keywords.trim()) {
      Alert.alert('Missing Keyword', 'Please enter at least one search keyword!');
      return;
    }

    setIsLoading(true);
    setStatusMessage('🔥 Phase 1: Scraping X feeds with Playwright Chromium...');
    setPosts([]);
    setLeads([]);

    try {
      const response = await fetch(`${backendUrl}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywords,
          maxScrolls: parseInt(scrollDepth, 10) || 5,
        }),
      });

      const data = await response.json();
      setIsLoading(false);

      if (data.error) {
        Alert.alert('Scrape Error', data.error);
        return;
      }

      setPosts(data.posts || []);

      if (data.geminiReport) {
        parseGeminiReport(data.geminiReport);
      }
    } catch (err) {
      setIsLoading(false);
      Alert.alert(
        'Connection Error',
        `Could not connect to server at ${backendUrl}.\n\n💡 Tip: If using Wi-Fi, enter your PC IP (http://10.222.207.88:5000).\nIf using Render Cloud, enter your Render URL (https://...onrender.com).`
      );
    }
  };

  const parseGeminiReport = (rawReport) => {
    try {
      const cleaned = rawReport.replace(/```json/g, '').replace(/```/g, '').trim();
      if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
        const parsed = JSON.parse(cleaned);
        setLeads(parsed);
      }
    } catch (e) {
      console.log('Plain text Gemini report mode');
    }
  };

  const handleCopy = (text) => {
    Clipboard.setString(text);
    Alert.alert('Copied! 📋', 'DM Pitch copied to clipboard ready to send on X!');
  };

  const handleOpenUrl = (url) => {
    if (url) Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050508" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🔥</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>X AI LEAD FINDER</Text>
            <Text style={styles.headerSub}>Gemini 3.6 AI Lead Qualifier</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(!showSettings)}>
          <Text style={styles.settingsBtnText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* SETTINGS CARD TOGGLE */}
      {showSettings ? (
        <View style={styles.settingsCard}>
          <Text style={styles.settingLabel}>Cloud / Backend API URL:</Text>
          <TextInput
            style={styles.settingInput}
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="https://your-app.onrender.com"
            placeholderTextColor="#71717a"
            autoCapitalize="none"
          />
          <Text style={styles.settingHint}>Wi-Fi: http://10.222.207.88:5000 | Render: https://...onrender.com</Text>
        </View>
      ) : null}

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* HERO GEMINI BANNER */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <Text style={styles.heroBadge}>GEMINI 3.6 ACTIVE</Text>
            <Text style={styles.heroStatus}>⚡ 24/7 AI Lead Scraper</Text>
          </View>
          <Text style={styles.heroTitle}>AI Lead Qualifier</Text>
          <Text style={styles.heroDesc}>
            Scrapes X in real-time & qualifies high-ticket AI automation buyers for your agency (Claude, Google Antigravity, Custom Systems).
          </Text>
        </View>

        {/* INPUT CARD */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>ENTER KEYWORDS TO SEARCH ON X:</Text>
          <TextInput
            style={styles.textArea}
            value={keywords}
            onChangeText={setKeywords}
            placeholder="need chatbot, hire developer, web scraper"
            placeholderTextColor="#52525b"
            multiline
          />

          {/* PRESET CHIPS */}
          <Text style={styles.presetTitle}>QUICK HIGH-INTENT PRESETS:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            {presets.map((item, idx) => (
              <TouchableOpacity key={idx} style={styles.chip} onPress={() => setKeywords(item)}>
                <Text style={styles.chipText}>⚡ {item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* CONTROLS */}
          <View style={styles.controlsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>SCROLL DEPTH:</Text>
              <TextInput
                style={styles.numberInput}
                value={scrollDepth}
                onChangeText={setScrollDepth}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleStartScrape}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>🚀 RUN AI SCRAPE</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* LOADING STATUS */}
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="medium" color="#ef4444" />
            <Text style={styles.loadingText}>{statusMessage}</Text>
          </View>
        ) : null}

        {/* TAB BAR */}
        {posts.length > 0 || leads.length > 0 ? (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'leads' && styles.tabActive]}
              onPress={() => setActiveTab('leads')}
            >
              <Text style={[styles.tabText, activeTab === 'leads' && styles.tabTextActive]}>
                🎯 QUALIFIED LEADS ({leads.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'all' && styles.tabActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                📋 ALL POSTS ({posts.length})
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* LEADS FEED */}
        {activeTab === 'leads' && leads.length > 0
          ? leads.map((lead, idx) => (
              <View key={idx} style={styles.leadCard}>
                <View style={styles.leadHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leadName}>{lead.name}</Text>
                    <Text style={styles.leadHandle}>{lead.handle}</Text>
                  </View>
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreText}>🔥 {lead.intentScore || 90}% INTENT</Text>
                  </View>
                </View>

                <Text style={styles.leadTweet}>"{lead.tweet}"</Text>

                {lead.reasoning ? (
                  <View style={styles.reasoningBox}>
                    <Text style={styles.reasoningText}>💡 {lead.reasoning}</Text>
                  </View>
                ) : null}

                {lead.suggestedDm ? (
                  <View style={styles.dmBox}>
                    <Text style={styles.dmLabel}>✉️ SUGGESTED DM PITCH:</Text>
                    <Text style={styles.dmText}>"{lead.suggestedDm}"</Text>
                  </View>
                ) : null}

                {/* ACTIONS */}
                <View style={styles.actionRow}>
                  {lead.tweetUrl ? (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenUrl(lead.tweetUrl)}>
                      <Text style={styles.actionBtnText}>🔗 Tweet</Text>
                    </TouchableOpacity>
                  ) : null}

                  {lead.profileUrl ? (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenUrl(lead.profileUrl)}>
                      <Text style={styles.actionBtnText}>👤 Profile</Text>
                    </TouchableOpacity>
                  ) : null}

                  {lead.suggestedDm ? (
                    <TouchableOpacity style={styles.actionBtnRed} onPress={() => handleCopy(lead.suggestedDm)}>
                      <Text style={styles.actionBtnRedText}>📋 Copy DM</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          : null}

        {/* RAW POSTS FEED */}
        {activeTab === 'all' && posts.length > 0
          ? posts.map((p, idx) => (
              <View key={idx} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Text style={styles.postAuthor}>{p.name}</Text>
                  <Text style={styles.postHandle}>{p.handle}</Text>
                </View>
                <Text style={styles.postText}>{p.text}</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenUrl(p.tweetUrl)}>
                    <Text style={styles.actionBtnText}>🔗 Open Tweet on X</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          : null}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── CRIMSON RED & ONYX BLACK CYBERPUNK STYLES ──────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050508',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#0d0d12',
    borderBottomWidth: 1.5,
    borderBottomColor: '#9f1239',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#b91c1c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowRadius: 10,
    shadowOpacity: 0.6,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 22,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  settingsBtn: {
    padding: 8,
    backgroundColor: '#18181b',
    borderRadius: 10,
  },
  settingsBtnText: {
    fontSize: 18,
  },
  settingsCard: {
    backgroundColor: '#111116',
    margin: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9f1239',
  },
  settingLabel: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  settingInput: {
    backgroundColor: '#18181c',
    color: '#ffffff',
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  settingHint: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 6,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroCard: {
    backgroundColor: '#12070a',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#dc2626',
    marginBottom: 16,
    shadowColor: '#dc2626',
    shadowRadius: 12,
    shadowOpacity: 0.3,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroBadge: {
    backgroundColor: '#9f1239',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  heroStatus: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroDesc: {
    color: '#a1a1aa',
    fontSize: 12.5,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#0d0d12',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 16,
  },
  inputLabel: {
    color: '#e4e4e7',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textArea: {
    backgroundColor: '#18181c',
    color: '#ffffff',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3f3f46',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  presetTitle: {
    color: '#71717a',
    fontSize: 10.5,
    fontWeight: '800',
    marginBottom: 8,
  },
  presetScroll: {
    marginBottom: 14,
  },
  chip: {
    backgroundColor: '#1c0d12',
    borderWidth: 1,
    borderColor: '#be123c',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginRight: 8,
  },
  chipText: {
    color: '#fb7185',
    fontSize: 12,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  numberInput: {
    backgroundColor: '#18181c',
    color: '#ffffff',
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3f3f46',
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButton: {
    flex: 2,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowRadius: 10,
    shadowOpacity: 0.5,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  loadingCard: {
    backgroundColor: '#18090e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f43f5e',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  loadingText: {
    color: '#f43f5e',
    fontSize: 13,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    backgroundColor: '#18181c',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  tabActive: {
    backgroundColor: '#9f1239',
    borderColor: '#ef4444',
  },
  tabText: {
    color: '#71717a',
    fontSize: 11.5,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  leadCard: {
    backgroundColor: '#0f0a12',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#be123c',
    marginBottom: 14,
    shadowColor: '#ef4444',
    shadowRadius: 8,
    shadowOpacity: 0.25,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  leadName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  leadHandle: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  scoreBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '900',
  },
  leadTweet: {
    color: '#e4e4e7',
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 12,
  },
  reasoningBox: {
    backgroundColor: '#181014',
    borderLeftWidth: 3,
    borderLeftColor: '#f43f5e',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  reasoningText: {
    color: '#fda4af',
    fontSize: 12.5,
    lineHeight: 18,
  },
  dmBox: {
    backgroundColor: '#1c080e',
    borderWidth: 1,
    borderColor: '#881337',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  dmLabel: {
    color: '#fb7185',
    fontSize: 10.5,
    fontWeight: '900',
    marginBottom: 4,
  },
  dmText: {
    color: '#ffe4e6',
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    backgroundColor: '#18181c',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  actionBtnText: {
    color: '#e4e4e7',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnRed: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnRedText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  postCard: {
    backgroundColor: '#0d0d12',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  postAuthor: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  postHandle: {
    color: '#71717a',
    fontSize: 12,
  },
  postText: {
    color: '#d4d4d8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
});
