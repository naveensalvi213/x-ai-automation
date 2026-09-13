import { io } from 'socket.io-client';
import { normalizeBackendUrl, DEFAULT_BACKEND_URL } from './api.js';

let socketInstance = null;
let currentSocketUrl = null;

/**
 * Retrieves or establishes a persistent Socket.IO connection
 */
export function getSocketInstance(backendUrl = DEFAULT_BACKEND_URL) {
  const normalizedUrl = normalizeBackendUrl(backendUrl);

  if (socketInstance && currentSocketUrl !== normalizedUrl) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  if (!socketInstance) {
    currentSocketUrl = normalizedUrl;
    socketInstance = io(normalizedUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 15000,
    });

    socketInstance.on('connect', () => {
      console.log(`[Socket] Connected to ${normalizedUrl} (id: ${socketInstance.id})`);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn(`[Socket] Connection error on ${normalizedUrl}:`, err.message);
    });
  }

  return socketInstance;
}

/**
 * Subscribes to backend 'search:status' events emitted during Playwright scraping & Gemini qualification
 */
export function subscribeToSearchProgress(callback, backendUrl = DEFAULT_BACKEND_URL) {
  const socket = getSocketInstance(backendUrl);

  const handler = (data) => {
    if (typeof callback === 'function') {
      callback(data);
    }
  };

  socket.on('search:status', handler);

  return () => {
    socket.off('search:status', handler);
  };
}

/**
 * Disconnects the active socket connection
 */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentSocketUrl = null;
  }
}
