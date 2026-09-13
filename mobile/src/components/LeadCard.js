import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet, Alert } from 'react-native';

/**
 * Returns color tokens based on lead match score
 */
export function getScoreBadgeColors(score = 0) {
  const num = Number(score) || 0;
  if (num >= 85) {
    return { bg: '#064e3b', border: '#059669', text: '#34d399', label: 'High Intent' };
  }
  if (num >= 70) {
    return { bg: '#0c4a6e', border: '#0284c7', text: '#38bdf8', label: 'Good Match' };
  }
  if (num >= 50) {
    return { bg: '#451a03', border: '#d97706', text: '#fbbf24', label: 'Moderate' };
  }
  return { bg: '#4c0519', border: '#e11d48', text: '#fb7185', label: 'Low Intent' };
}

/**
 * Formats handle with leading @ if missing
 */
export function formatHandle(handle) {
  if (!handle) return '@unknown';
  return handle.startsWith('@') ? handle : `@${handle}`;
}

/**
 * Visual Lead Card Component for qualified leads
 */
export function LeadCard({ lead = {}, onCopyPitch }) {
  const {
    name = 'Anonymous Prospect',
    handle = '@user',
    profileUrl,
    tweetUrl,
    tweetText = 'No tweet text provided.',
    matchScore = 0,
    matchReasoning = 'No reasoning provided.',
    suggestedDm = '',
  } = lead;

  const scoreInfo = getScoreBadgeColors(matchScore);
  const formattedHandle = formatHandle(handle);

  const resolvedProfileUrl =
    profileUrl || `https://x.com/${formattedHandle.replace('@', '')}`;

  const handleOpenUrl = async (url, fallbackName = 'link') => {
    if (!url) {
      Alert.alert('Unavailable', `No valid ${fallbackName} URL found for this prospect.`);
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url); // Attempt anyway on modern mobile OS
      }
    } catch (err) {
      console.warn(`Failed to open URL: ${url}`, err);
      Alert.alert('Error', `Could not open ${fallbackName}: ${err.message}`);
    }
  };

  const handleCopy = () => {
    if (typeof onCopyPitch === 'function') {
      onCopyPitch(suggestedDm, lead);
    } else {
      Alert.alert('DM Pitch Copied to Clipboard!', suggestedDm, [{ text: 'OK' }]);
    }
  };

  return React.createElement(
    View,
    { style: styles.cardContainer, testID: 'lead-card' },
    // Header Row: Name, Handle & Match Score Badge
    React.createElement(
      View,
      { style: styles.headerRow },
      React.createElement(
        View,
        { style: styles.authorInfo },
        React.createElement(
          Text,
          { style: styles.authorName, numberOfLines: 1 },
          name
        ),
        React.createElement(
          Text,
          { style: styles.authorHandle },
          formattedHandle
        )
      ),
      React.createElement(
        View,
        {
          style: [
            styles.scoreBadge,
            { backgroundColor: scoreInfo.bg, borderColor: scoreInfo.border },
          ],
          testID: 'score-badge',
        },
        React.createElement(
          Text,
          { style: [styles.scoreText, { color: scoreInfo.text }] },
          `${matchScore}% Match`
        )
      )
    ),

    // Tweet Content Box
    React.createElement(
      View,
      { style: styles.tweetBox },
      React.createElement(Text, { style: styles.sectionLabel }, 'POST ON X'),
      React.createElement(
        Text,
        { style: styles.tweetText, numberOfLines: 6 },
        `"${tweetText}"`
      )
    ),

    // AI Intent & Reasoning Box
    React.createElement(
      View,
      { style: styles.reasoningBox },
      React.createElement(
        Text,
        { style: styles.reasoningLabel },
        '🧠 Buyer Intent Analysis'
      ),
      React.createElement(
        Text,
        { style: styles.reasoningText },
        matchReasoning
      )
    ),

    // Suggested AI DM Pitch Box
    suggestedDm
      ? React.createElement(
          View,
          { style: styles.dmPitchBox },
          React.createElement(
            Text,
            { style: styles.dmPitchLabel },
            '✨ Personalized DM Pitch'
          ),
          React.createElement(
            Text,
            { style: styles.dmPitchText },
            suggestedDm
          )
        )
      : null,

    // Action Buttons Row
    React.createElement(
      View,
      { style: styles.actionsRow },
      React.createElement(
        TouchableOpacity,
        {
          style: [styles.actionButton, styles.profileBtn],
          onPress: () => handleOpenUrl(resolvedProfileUrl, 'Profile'),
          activeOpacity: 0.7,
          testID: 'btn-open-profile',
        },
        React.createElement(
          Text,
          { style: styles.actionButtonText },
          '🔗 Profile'
        )
      ),
      tweetUrl
        ? React.createElement(
            TouchableOpacity,
            {
              style: [styles.actionButton, styles.tweetBtn],
              onPress: () => handleOpenUrl(tweetUrl, 'Tweet'),
              activeOpacity: 0.7,
              testID: 'btn-open-tweet',
            },
            React.createElement(
              Text,
              { style: styles.actionButtonText },
              '💬 Tweet'
            )
          )
        : null,
      React.createElement(
        TouchableOpacity,
        {
          style: [styles.actionButton, styles.copyBtn],
          onPress: handleCopy,
          activeOpacity: 0.7,
          testID: 'btn-copy-pitch',
        },
        React.createElement(
          Text,
          { style: styles.copyButtonText },
          '📋 Copy Pitch'
        )
      )
    )
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorInfo: {
    flex: 1,
    marginRight: 10,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
  },
  authorHandle: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tweetBox: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tweetText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#e2e8f0',
    fontStyle: 'italic',
  },
  reasoningBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reasoningLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a78bfa',
    marginBottom: 4,
  },
  reasoningText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#cbd5e1',
  },
  dmPitchBox: {
    backgroundColor: '#0c1a2e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  dmPitchLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60a5fa',
    marginBottom: 4,
  },
  dmPitchText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#f8fafc',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  actionButtonText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  profileBtn: {
    backgroundColor: '#1e293b',
  },
  tweetBtn: {
    backgroundColor: '#1e293b',
  },
  copyBtn: {
    backgroundColor: '#1d4ed8',
    borderColor: '#3b82f6',
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default LeadCard;
