import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8787';

/**
 * useWebSocket - Simple hook for real-time WebSocket notifications
 *
 * Listens for: 'data-update', 'level-change', 'connection-status'
 * Returns: { status, circuitBreaker, usingCache, lastUpdate }
 *
 * NO dependency on addToast or other App functions.
 * Polling remains the PRIMARY data source - this is bonus/notifications only.
 */
export function useWebSocket() {
  const [status, setStatus] = useState('disconnected'); // 'connected' | 'disconnected'
  const [circuitBreaker, setCircuitBreaker] = useState('CLOSED'); // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  const [usingCache, setUsingCache] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [wsData, setWsData] = useState(null); // Latest data from WebSocket (bonus)
  const socketRef = useRef(null);

  useEffect(() => {
    let socket;

    try {
      socket = io(WS_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
      });
      socketRef.current = socket;
    } catch (err) {
      console.warn('[useWebSocket] Failed to create socket:', err);
      return;
    }

    socket.on('connect', () => {
      console.log('[useWebSocket] Connected');
      setStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[useWebSocket] Disconnected:', reason);
      setStatus('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.warn('[useWebSocket] Connection error:', err.message);
      setStatus('disconnected');
    });

    socket.on('connection-status', (data) => {
      console.log('[useWebSocket] connection-status:', data);
      if (data.circuitBreaker) {
        setCircuitBreaker(data.circuitBreaker);
      }
      if (data.usingCache !== undefined) {
        setUsingCache(data.usingCache);
      }
    });

    socket.on('data-update', (data) => {
      console.log('[useWebSocket] data-update received');
      setLastUpdate(new Date().toISOString());
      setWsData(data);
    });

    socket.on('level-change', (data) => {
      console.log('[useWebSocket] level-change:', data);
      setLastUpdate(new Date().toISOString());
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return {
    status,
    circuitBreaker,
    usingCache,
    lastUpdate,
    wsData, // Bonus: latest data from WebSocket, can be used to update UI
  };
}