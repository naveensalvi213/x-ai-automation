import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  DEFAULT_BACKEND_URL,
  LOCAL_BACKEND_URL,
  checkServerHealth,
  normalizeBackendUrl,
} from './src/services/api.js';
import ChatScreen from './src/components/ChatScreen.js';

export function App() {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [inputUrl, setInputUrl] = useState(DEFAULT_BACKEND_URL);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking'); // 'connected' | 'checking' | 'error'
  const [statusMessage, setStatusMessage] = useState('Connecting to Render Backend...');
  const [isChecking, setIsChecking] = useState(false);

  const verifyConnection = async (urlToTest) => {
    setIsChecking(true);
    setConnectionStatus('checking');
    setStatusMessage('Checking backend health...');

    const result = await checkServerHealth({ backendUrl: urlToTest });
    setIsChecking(false);

    if (result.connected) {
      setConnectionStatus('connected');
      const isRender = result.url.includes('onrender.com');
      setStatusMessage(
        isRender ? 'Connected to Render Backend' : `Connected to Backend (${result.url})`
      );
    } else {
      setConnectionStatus('error');
      setStatusMessage(`Backend Unreachable (${result.error || 'Check URL'})`);
    }
  };

  useEffect(() => {
    verifyConnection(backendUrl);
  }, [backendUrl]);

  const handleApplyUrl = (newUrl) => {
    const cleaned = normalizeBackendUrl(newUrl);
    setBackendUrl(cleaned);
    setInputUrl(cleaned);
    setIsSettingsOpen(false);
  };

  const getStatusDotColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#10b981'; // Emerald
      case 'checking':
        return '#f59e0b'; // Amber
      case 'error':
      default:
        return '#ef4444'; // Red
    }
  };

  return React.createElement(
    SafeAreaView,
    { style: styles.safeArea, testID: 'root-app' },
    React.createElement(StatusBar, {
      barStyle: 'light-content',
      backgroundColor: '#090d16',
    }),

    // Header Bar with Status Indicator & Settings Toggle
    React.createElement(
      View,
      { style: styles.header, testID: 'app-header' },
      React.createElement(
        View,
        { style: styles.titleBlock },
        React.createElement(
          Text,
          { style: styles.appTitle },
          '⚡ X AI Lead Finder'
        ),
        React.createElement(
          View,
          { style: styles.statusRow },
          React.createElement(View, {
            style: [styles.statusDot, { backgroundColor: getStatusDotColor() }],
            testID: 'status-indicator-dot',
          }),
          React.createElement(
            Text,
            { style: styles.statusText, numberOfLines: 1 },
            statusMessage
          )
        )
      ),
      React.createElement(
        TouchableOpacity,
        {
          style: styles.settingsButton,
          onPress: () => setIsSettingsOpen(true),
          activeOpacity: 0.7,
          testID: 'btn-open-settings',
        },
        React.createElement(Text, { style: styles.settingsButtonText }, '⚙️ Settings')
      )
    ),

    // Main Chat Screen Feed
    React.createElement(
      View,
      { style: styles.contentContainer },
      React.createElement(ChatScreen, {
        backendUrl,
        onStatusChange: (msg) => setStatusMessage(msg),
      })
    ),

    // Settings Modal for Backend URL Configuration
    React.createElement(
      Modal,
      {
        visible: isSettingsOpen,
        animationType: 'slide',
        transparent: true,
        onRequestClose: () => setIsSettingsOpen(false),
        testID: 'settings-modal',
      },
      React.createElement(
        View,
        { style: styles.modalOverlay },
        React.createElement(
          View,
          { style: styles.modalCard },
          React.createElement(
            Text,
            { style: styles.modalTitle },
            '⚙️ Backend Server Settings'
          ),
          React.createElement(
            Text,
            { style: styles.modalDescription },
            'Configure the backend endpoint for Playwright scraping and Gemini AI qualification.'
          ),

          // Presets
          React.createElement(
            View,
            { style: styles.presetsRow },
            React.createElement(
              TouchableOpacity,
              {
                style: styles.presetBtn,
                onPress: () => setInputUrl(DEFAULT_BACKEND_URL),
                activeOpacity: 0.7,
              },
              React.createElement(
                Text,
                { style: styles.presetBtnText },
                '🌐 Render Cloud'
              )
            ),
            React.createElement(
              TouchableOpacity,
              {
                style: styles.presetBtn,
                onPress: () => setInputUrl(LOCAL_BACKEND_URL),
                activeOpacity: 0.7,
              },
              React.createElement(
                Text,
                { style: styles.presetBtnText },
                '💻 Localhost (10000)'
              )
            )
          ),

          // URL Input
          React.createElement(
            Text,
            { style: styles.inputLabel },
            'Backend API Base URL:'
          ),
          React.createElement(TextInput, {
            style: styles.urlInput,
            value: inputUrl,
            onChangeText: setInputUrl,
            placeholder: 'https://...',
            placeholderTextColor: '#64748b',
            autoCapitalize: 'none',
            autoCorrect: false,
            testID: 'input-backend-url',
          }),

          // Action Buttons
          React.createElement(
            View,
            { style: styles.modalActions },
            React.createElement(
              TouchableOpacity,
              {
                style: [styles.modalActionBtn, styles.testBtn],
                onPress: () => verifyConnection(inputUrl),
                disabled: isChecking,
                activeOpacity: 0.7,
              },
              isChecking
                ? React.createElement(ActivityIndicator, {
                    size: 'small',
                    color: '#38bdf8',
                  })
                : React.createElement(
                    Text,
                    { style: styles.testBtnText },
                    'Ping Health'
                  )
            ),
            React.createElement(
              TouchableOpacity,
              {
                style: [styles.modalActionBtn, styles.saveBtn],
                onPress: () => handleApplyUrl(inputUrl),
                activeOpacity: 0.7,
                testID: 'btn-save-url',
              },
              React.createElement(
                Text,
                { style: styles.saveBtnText },
                'Save & Connect'
              )
            )
          ),

          // Close Modal Button
          React.createElement(
            TouchableOpacity,
            {
              style: styles.closeModalBtn,
              onPress: () => setIsSettingsOpen(false),
            },
            React.createElement(
              Text,
              { style: styles.closeModalText },
              'Cancel'
            )
          )
        )
      )
    )
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0c111d',
  },
  titleBlock: {
    flex: 1,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    flexShrink: 1,
  },
  settingsButton: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 8,
  },
  settingsButtonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 6,
  },
  modalDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  presetBtnText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  urlInput: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtn: {
    backgroundColor: '#1e293b',
    borderColor: '#38bdf8',
    borderWidth: 1,
  },
  testBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#0284c7',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  closeModalBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  closeModalText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});

export default App;
