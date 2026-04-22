import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { loadConfig, saveConfig } from '../utils/storage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api/running-products';
const ALERT_SOUND = `${import.meta.env.BASE_URL}alert.mp3`;
const INACTIVE_MS = 5 * 60 * 1000;

function extractApiPayload(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('API trả dữ liệu rỗng/không hợp lệ');
  }
  if (json.success === false) {
    throw new Error(json?.error?.message || 'Fetch failed');
  }
  if (json.success === true) {
    if (!json.data || typeof json.data !== 'object') {
      throw new Error('API trả dữ liệu rỗng/không hợp lệ');
    }
    return { payload: json.data, meta: json.meta || {} };
  }
  if (json.data && typeof json.data === 'object') {
    return { payload: json, meta: json.meta || {} };
  }
  throw new Error('API trả dữ liệu rỗng/không hợp lệ');
}

function levelClass(n) {
  if (n >= 10) return 'hot';
  if (n >= 3) return 'warm';
  return 'idle';
}

const defaultCfg = {
  token: '',
  internalKey: '',
  soundEnabled: false,
  toastEnabled: true,
  videoIconsEnabled: false,
};

export function useDashboardData(addToast) {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastOkAt, setLastOkAt] = useState('');
  const [stale, setStale] = useState(false);
  const [health, setHealth] = useState({ state: 'idle', latencyMs: 0 });
  const [changedKeys, setChangedKeys] = useState(new Set());

  const [cfg, setCfg] = useState(() => loadConfig(defaultCfg));
  const prevMapRef = useRef(new Map());
  const lastActiveRef = useRef(new Map());
  const prevOrdersRef = useRef(new Map());
  const audioRef = useRef(null);
  const toastTimersRef = useRef([]);

  // WebSocket — PRIMARY data source (real-time push from backend)
  const { status: wsStatus, circuitBreaker: wsCircuitBreaker, usingCache: wsUsingCache, lastUpdate: wsLastUpdate, wsData, levelChanges } = useWebSocket();

  // WebSocket data update — this is now the PRIMARY data source
  useEffect(() => {
    if (wsData && wsData.success && wsData.data) {
      setData(wsData.data);
      setMeta(wsData.meta || {});
      setError('');
      setLastOkAt(new Date().toISOString());
      setStale(false);
      setLoading(false);
      setRefreshing(false);
      setHealth(prev => prev.state === 'error' ? { state: 'ok', latencyMs: 0 } : prev);
    }
  }, [wsData]);

  // Process level changes from WebSocket for alerts
  useEffect(() => {
    if (!levelChanges || levelChanges.length === 0) return;

    // Only process new level changes (last few)
    const recentChanges = levelChanges.slice(0, 3);
    for (const change of recentChanges) {
      if (change.newLevel === 'hot' && cfg.soundEnabled) {
        playAlert();
      }
      if (cfg.toastEnabled) {
        const arrow = change.prevLevel === 'hot' ? '📉' : change.newLevel === 'hot' ? '🚀' : '🔄';
        addToast?.(`${arrow} ${change.merchant} - ${change.product}: ${change.prevLevel} → ${change.newLevel} (${change.orders} đơn)`, change.newLevel === 'hot' ? 'hot' : 'info', 4000);
      }
    }
  }, [levelChanges]);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(ALERT_SOUND);
    audioRef.current.volume = 0.5;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Cleanup toast timers on unmount
  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach(id => clearTimeout(id));
    };
  }, []);

  // Play sound alert
  const playAlert = useCallback(() => {
    if (cfg.soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [cfg.soundEnabled]);

  const fetchData = useCallback(async () => {
    const t0 = performance.now();
    try {
      setRefreshing(true);
      setError('');
      let json;
      let lastErr;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          const headers = {};
          if (cfg.token?.trim()) headers['x-product-token'] = cfg.token.trim();
          if (cfg.internalKey?.trim()) headers['x-internal-key'] = cfg.internalKey.trim();

          const res = await fetch(API_URL, {
            signal: controller.signal,
            headers
          });
          clearTimeout(timer);
          json = await res.json();
          if (!res.ok) {
            throw new Error(json?.error?.message || json?.message || 'Fetch failed');
          }
          extractApiPayload(json);
          break;
        } catch (e) {
          lastErr = e;
          if (attempt < 2) await new Promise(r => setTimeout(r, 700));
        }
      }

      if (!json) throw lastErr || new Error('Fetch failed');

      const { payload, meta: nextMeta } = extractApiPayload(json);
      const latencyMs = Math.round(performance.now() - t0);

      const prevOrders = prevOrdersRef.current;
      const newOrders = new Map();
      let hasHotProduct = false;
      let significantChanges = [];

      for (const [merchant, items] of Object.entries(payload?.data || {})) {
        const list = Array.isArray(items) ? items : [];
        for (const item of list) {
          const key = `${merchant}|||${item?.product || ''}`;
          const orders = Number(item?.ordersInWindow || 0);
          newOrders.set(key, orders);
          const prev = prevOrders.get(key);
          if (prev !== undefined && orders >= 10 && (prev < 10 || orders - prev >= 5)) {
            hasHotProduct = true;
            significantChanges.push({ merchant, product: item?.product || 'Unknown', orders, prev: prev || 0 });
          }
        }
      }

      if (hasHotProduct && cfg.soundEnabled) {
        playAlert();
      }

      if (significantChanges.length > 0 && cfg.toastEnabled) {
        significantChanges.slice(0, 3).forEach(change => {
          addToast?.(`🔥 ${change.merchant} - ${change.product}: ${change.orders} đơn (${change.prev} → ${change.orders})`, 'hot', 5000);
        });
      }

      prevOrdersRef.current = newOrders;
      setData(payload);
      setMeta(nextMeta || {});
      setLastOkAt(new Date().toISOString());
      setStale(false);
      setHealth({ state: latencyMs > 2000 ? 'slow' : 'ok', latencyMs });
    } catch (e) {
      const latencyMs = Math.round(performance.now() - t0);
      // Only set error if we don't already have WebSocket data
      // This prevents a failed HTTP fetch from hiding valid WS data
      if (!data) {
        setError(e.message);
      }
      setStale(true);
      setHealth({ state: 'error', latencyMs });
      addToast?.(`❌ Lỗi: ${e.message}`, 'error', 5000);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cfg, addToast, playAlert]);

  // Persist config
  useEffect(() => {
    saveConfig(cfg);
  }, [cfg]);

  // Auto-refresh (fallback — only if WebSocket is disconnected)
  // WebSocket is PRIMARY, this is safety net
  useEffect(() => {
    // Only do initial HTTP fetch if WebSocket isn't connected yet
    // WebSocket will provide data once connected
    if (wsStatus !== 'connected') {
      fetchData();
    } else if (!data) {
      // WebSocket connected but no data yet — still do initial fetch as backup
      fetchData();
    }
    const id = setInterval(() => {
      // Only poll if WebSocket is disconnected — otherwise data comes via push
      if (wsStatus === 'disconnected') {
        fetchData();
      }
    }, 60000); // 60s fallback poll (was 20s, now less aggressive)
    return () => clearInterval(id);
  }, [fetchData, wsStatus]);

  // Derived data
  const safeData = useMemo(() => (
    data?.data && typeof data.data === 'object' ? data.data : {}
  ), [data]);

  useEffect(() => {
    const now = Date.now();
    for (const [merchant, items] of Object.entries(safeData)) {
      const list = Array.isArray(items) ? items : [];
      for (const item of list) {
        const key = `${merchant}|||${item?.product || ''}`;
        const n = Number(item?.ordersInWindow || 0);
        if (n > 0) lastActiveRef.current.set(key, now);
      }
    }
  }, [safeData]);

  const allMerchantEntries = useMemo(() => {
    const now = Date.now();
    return Object.entries(safeData)
      .map(([merchant, items]) => {
        const list = Array.isArray(items) ? items : [];
        const normalized = list.map((x) => ({ ...x, ordersInWindow: Number(x?.ordersInWindow || 0) }));
        const activeItems = normalized.filter((x) => {
          const key = `${merchant}|||${x?.product || ''}`;
          if ((x?.ordersInWindow || 0) > 0) return true;
          const lastActive = lastActiveRef.current.get(key);
          if (!lastActive) return false;
          return (now - lastActive) < INACTIVE_MS;
        });
        const sumOrders = activeItems.reduce((s, x) => s + (x?.ordersInWindow || 0), 0);
        const allInactive = activeItems.length === 0;
        return [merchant, activeItems, sumOrders, allInactive, normalized.length];
      });
  }, [safeData]);

  const runningMerchants = useMemo(
    () => allMerchantEntries.filter(([, , , inactive]) => !inactive),
    [allMerchantEntries]
  );
  const stoppedMerchants = useMemo(
    () => allMerchantEntries.filter(([, , , inactive]) => inactive),
    [allMerchantEntries]
  );

  return {
    data, meta, loading, refreshing, error, lastOkAt, stale, health,
    changedKeys, setChangedKeys,
    cfg, setCfg,
    safeData, allMerchantEntries, runningMerchants, stoppedMerchants,
    fetchData,
    wsStatus, wsCircuitBreaker, wsUsingCache, wsLastUpdate, levelChanges,
    prevMapRef, lastActiveRef,
  };
}

export default useDashboardData;