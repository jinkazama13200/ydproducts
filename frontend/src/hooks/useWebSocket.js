import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8787';

/**
 * useWebSocket - Real-time WebSocket hook
 *
 * PRIMARY data source: receives 'data-update' pushed from backend auto-poll
 * Also tracks: 'level-change', 'connection-status'
 *
 * Returns: { status, circuitBreaker, usingCache, lastUpdate, wsData, levelChanges }
 */
export function useWebSocket() {
  const [status, setStatus] = useState('disconnected');
  const [circuitBreaker, setCircuitBreaker] = useState('CLOSED');
  const [usingCache, setUsingCache] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [wsData, setWsData] = useState(null);
  const [levelChanges, setLevelChanges] = useState([]); // Recent level changes
  const socketRef = useRef(null);

  useEffect(() => {
    let socket;

    try {
      socket = io(WS_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
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
      if (data.circuitBreaker) setCircuitBreaker(data.circuitBreaker);
      if (data.usingCache !== undefined) setUsingCache(data.usingCache);
    });

    // Primary data source — pushed from backend auto-poll
    socket.on('data-update', (data) => {
      setLastUpdate(new Date().toISOString());
      setWsData(data);
    });

    // Level change events (hot↔warm↔idle transitions)
    socket.on('level-change', (change) => {
      setLastUpdate(new Date().toISOString());
      setLevelChanges(prev => {
        // Keep last 50 level changes, newest first
        const updated = [change, ...prev].slice(0, 50);
        return updated;
      });
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const clearLevelChanges = useCallback(() => {
    setLevelChanges([]);
  }, []);

  return {
    status,
    circuitBreaker,
    usingCache,
    lastUpdate,
    wsData,
    levelChanges,
    clearLevelChanges,
  };
}