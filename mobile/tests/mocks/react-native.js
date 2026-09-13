// Mock React Native module for Node.js test environment

export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const TextInput = 'TextInput';
export const ScrollView = 'ScrollView';
export const ActivityIndicator = 'ActivityIndicator';
export const SafeAreaView = 'SafeAreaView';
export const StatusBar = 'StatusBar';
export const Modal = 'Modal';
export const KeyboardAvoidingView = 'KeyboardAvoidingView';

export const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
};

export const Linking = {
  canOpenURL: async (url) => typeof url === 'string' && url.length > 0,
  openURL: async (url) => true,
};

export const Alert = {
  alert: (title, message, buttons) => {
    return { title, message, buttons };
  },
};

export const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios || obj.default,
};

export default {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Modal,
  KeyboardAvoidingView,
  StyleSheet,
  Linking,
  Alert,
  Platform,
};
