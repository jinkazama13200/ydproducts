import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_URL = 'http://localhost:8787/api/running-products';
const HOT_VIDEO = `${import.meta.env.BASE_URL}hot-icon.mp4`;
const WARM_VIDEO = `${import.meta.env.BASE_URL}warm-icon.mp4`;
const IDLE_VIDEO = `${import.meta.env.BASE_URL}idle-icon.mp4`;
const ALERT_SOUND = `${import.meta.env.BASE_URL}alert.mp3`;

function LevelIcon({ n, showLabel = false }) {
  const [failed, setFailed] = useState(false);
  const label = levelLabel(n);

  if (n >= 10) {
    if (failed) {
      return (
        <span className="level-indicator hot" role="img" aria-label="Hot level">
          🔥 {showLabel && <span className="level-text">Hot</span>}
        </span>
      );
    }
    return (
      <span className="level-indicator hot" role="img" aria-label="Hot level">
        <video className="hot-gif" src={HOT_VIDEO} autoPlay muted loop playsInline onError={() => setFailed(true)} />
        {showLabel && <span className="level-text">Hot</span>}
      </span>
    );
  }
  if (n >= 3) {
    if (failed) {
      return (
        <span className="level-indicator warm" role="img" aria-label="Warm level">
          🟢 {showLabel && <span className="level-text">Warm</span>}
        </span>
      );
    }
    return (
      <span className="level-indicator warm" role="img" aria-label="Warm level">
        <video className="warm-gif" src={WARM_VIDEO} autoPlay muted loop playsInline onError={() => setFailed(true)} />
        {showLabel && <span className="level-text">Warm</span>}
      </span>
    );
  }

  if (failed) {
    return (
      <span className="level-indicator idle" role="img" aria-label="Idle level">
        ⚪ {showLabel && <span className="level-text">Idle</span>}
      </span>
    );
  }
  return (
    <span className="level-indicator idle" role="img" aria-label="Idle level">
      <video className="idle-gif" src={IDLE_VIDEO} autoPlay muted loop playsInline onError={() => setFailed(true)} />
      {showLabel && <span className="level-text">Idle</span>}
    </span>
  );
}

function levelClass(n) {
  if (n >= 10) return 'hot';
  if (n >= 3) return 'warm';
  return 'idle';
}

function levelLabel(n) {
  if (n >= 10) return 'Hot';
  if (n >= 3) return 'Warm';
  return 'Idle';
}

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
    return {
      payload: json.data,
      meta: json.meta || {}
    };
  }

  if (json.data && typeof json.data === 'object') {
    return {
      payload: json,
      meta: json.meta || {}
    };
  }

  throw new Error('API trả dữ liệu rỗng/không hợp lệ');
}

const defaultCfg = {
  token: '',
  internalKey: '',
  soundEnabled: false,
  toastEnabled: true
};

export default function App() {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastOkAt, setLastOkAt] = useState('');
  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [sortBy, setSortBy] = useState('orders');
  const [viewMode, setViewMode] = useState('table');
  const [levelFilter, setLevelFilter] = useState('all');
  const [showStopped, setShowStopped] = useState(false);
  const [health, setHealth] = useState({ state: 'idle', latencyMs: 0 });
  const [stale, setStale] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [internalKeyVisible, setInternalKeyVisible] = useState(false);
  const [changedKeys, setChangedKeys] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showLevelLabels, setShowLevelLabels] = useState(true);
  const prevMapRef = useRef(new Map());
  const lastActiveRef = useRef(new Map());
  const prevOrdersRef = useRef(new Map());
  const audioRef = useRef(null);
  const rowsRef = useRef([]);
  const INACTIVE_MS = 5 * 60 * 1000;
  const [cfg, setCfg] = useState(() => {
    const saved = localStorage.getItem('webCfg');
    return saved ? { ...defaultCfg, ...JSON.parse(saved) } : defaultCfg;
  });

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(ALERT_SOUND);
    audioRef.current.volume = 0.5;
  }, []);

  // Toast notification helper
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
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
      
      // Check for significant changes and trigger alerts
      const prevOrders = prevOrdersRef.current;
      const newOrders = new Map();
      let hasHotProduct = false;
      let significantChanges = [];

      for (const [merchant, items] of Object.entries(payload.data || {})) {
        const list = Array.isArray(items) ? items : [];
        for (const item of list) {
          const key = `${merchant}|||${item.product}`;
          const orders = Number(item.ordersInWindow || 0);
          newOrders.set(key, orders);
          
          const prev = prevOrders.get(key);
          if (prev !== undefined && orders >= 10 && (prev < 10 || orders - prev >= 5)) {
            hasHotProduct = true;
            significantChanges.push({ merchant, product: item.product, orders, prev: prev || 0 });
          }
        }
      }

      // Trigger alerts for hot products
      if (hasHotProduct && cfg.soundEnabled) {
        playAlert();
      }

      if (significantChanges.length > 0 && cfg.toastEnabled) {
        significantChanges.slice(0, 3).forEach(change => {
          addToast(`🔥 ${change.merchant} - ${change.product}: ${change.orders} đơn (${change.prev} → ${change.orders})`, 'hot', 5000);
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
      setError(e.message);
      setStale(true);
      setHealth({ state: 'error', latencyMs });
      addToast(`❌ Lỗi: ${e.message}`, 'error', 5000);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cfg, addToast, playAlert]);

  useEffect(() => {
    localStorage.setItem('webCfg', JSON.stringify(cfg));
  }, [cfg]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 20000);
    return () => clearInterval(id);
  }, [fetchData]);

  const safeData = useMemo(() => (
    data?.data && typeof data.data === 'object' ? data.data : {}
  ), [data]);

  useEffect(() => {
    const now = Date.now();
    for (const [merchant, items] of Object.entries(safeData)) {
      const list = Array.isArray(items) ? items : [];
      for (const item of list) {
        const key = `${merchant}|||${item.product}`;
        const n = Number(item.ordersInWindow || 0);
        if (n > 0) lastActiveRef.current.set(key, now);
      }
    }
  }, [safeData]);

  const allMerchantEntries = useMemo(() => {
    const now = Date.now();
    return Object.entries(safeData)
      .map(([merchant, items]) => {
        const list = Array.isArray(items) ? items : [];
        const normalized = list.map((x) => ({ ...x, ordersInWindow: Number(x.ordersInWindow || 0) }));
        const activeItems = normalized.filter((x) => {
          const key = `${merchant}|||${x.product}`;
          if (x.ordersInWindow > 0) return true;
          const lastActive = lastActiveRef.current.get(key);
          if (!lastActive) return false;
          return (now - lastActive) < INACTIVE_MS;
        });
        const sumOrders = activeItems.reduce((s, x) => s + x.ordersInWindow, 0);
        const allInactive = activeItems.length === 0;
        return [merchant, activeItems, sumOrders, allInactive, normalized.length];
      });
  }, [safeData]);

  const runningMerchants = useMemo(
    () => allMerchantEntries.filter(([,,,inactive]) => !inactive),
    [allMerchantEntries]
  );
  const stoppedMerchants = useMemo(
    () => allMerchantEntries.filter(([,,,inactive]) => inactive),
    [allMerchantEntries]
  );

  const merchantEntries = useMemo(() => {
    const filtered = runningMerchants
      .map(([merchant, items, sumOrders, inactive, totalProducts]) => {
        const filteredItems = items.filter((x) => {
          const q = query.trim().toLowerCase();
          const queryHit = !q || merchant.toLowerCase().includes(q) || x.product.toLowerCase().includes(q);
          const levelHit = levelFilter === 'all' || levelClass(x.ordersInWindow) === levelFilter;
          return queryHit && levelHit;
        });
        const nextSumOrders = filteredItems.reduce((s, x) => s + x.ordersInWindow, 0);
        return [merchant, filteredItems, nextSumOrders, inactive, totalProducts];
      })
      .filter(([merchant, items, sumOrders]) => {
        const q = query.trim().toLowerCase();
        const merchantHit = !q || merchant.toLowerCase().includes(q) || items.length > 0;
        const activeHit = !activeOnly || sumOrders > 0;
        return merchantHit && activeHit && items.length > 0;
      });

    filtered.sort((a, b) => {
      if (sortBy === 'name') return a[0].localeCompare(b[0]);
      if (sortBy === 'products') return b[1].length - a[1].length || b[2] - a[2];
      return b[2] - a[2] || a[0].localeCompare(b[0]);
    });

    return filtered;
  }, [runningMerchants, query, activeOnly, sortBy, levelFilter]);

  const flatRows = useMemo(() => {
    const rows = [];
    for (const [merchant, items, sumOrders] of merchantEntries) {
      for (const item of items) {
        rows.push({
          merchant,
          merchantOrders: sumOrders,
          ...item,
          level: levelClass(item.ordersInWindow)
        });
      }
    }
    return rows.sort((a, b) => {
      if (sortBy === 'name') return a.merchant.localeCompare(b.merchant) || a.product.localeCompare(b.product);
      if (sortBy === 'products') return b.merchantOrders - a.merchantOrders || b.ordersInWindow - a.ordersInWindow;
      return b.ordersInWindow - a.ordersInWindow || b.merchantOrders - a.merchantOrders;
    });
  }, [merchantEntries, sortBy]);

  // Store rows for keyboard navigation
  useEffect(() => {
    rowsRef.current = flatRows;
  }, [flatRows]);

  useEffect(() => {
    const next = new Map();
    const changed = new Set();
    for (const row of flatRows) {
      const key = `${row.merchant}|||${row.product}`;
      const prev = prevMapRef.current.get(key);
      next.set(key, row.ordersInWindow);
      if (prev !== undefined && prev !== row.ordersInWindow) changed.add(key);
    }
    prevMapRef.current = next;
    setChangedKeys(changed);
    if (changed.size) {
      const t = setTimeout(() => setChangedKeys(new Set()), 900);
      return () => clearTimeout(t);
    }
  }, [flatRows]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Tab navigation is handled by browser, but we add arrow key support
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const rows = rowsRef.current;
        if (rows.length === 0) return;
        
        setFocusedIndex(prev => {
          let next = prev;
          if (e.key === 'ArrowDown') {
            next = prev < rows.length - 1 ? prev + 1 : 0;
          } else {
            next = prev > 0 ? prev - 1 : rows.length - 1;
          }
          // Scroll into view
          const element = document.querySelector(`[data-row-index="${next}"]`);
          if (element) element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
      }
      
      // Enter to expand/collapse or select
      if (e.key === 'Enter' && focusedIndex >= 0) {
        const row = rowsRef.current[focusedIndex];
        if (row) {
          addToast(`📌 ${row.merchant} - ${row.product}: ${row.ordersInWindow} đơn`, 'info', 3000);
        }
      }
      
      // Esc to clear focus
      if (e.key === 'Escape') {
        setFocusedIndex(-1);
      }
      
      // Quick filters
      if (e.key === 'h' && !e.ctrlKey && !e.metaKey) {
        setLevelFilter('hot');
        addToast('🔥 Filter: Hot only', 'info', 2000);
      }
      if (e.key === 'w' && !e.ctrlKey && !e.metaKey) {
        setLevelFilter('warm');
        addToast('🟢 Filter: Warm only', 'info', 2000);
      }
      if (e.key === 'i' && !e.ctrlKey && !e.metaKey) {
        setLevelFilter('idle');
        addToast('⚪ Filter: Idle only', 'info', 2000);
      }
      if (e.key === 'a' && !e.ctrlKey && !e.metaKey) {
        setLevelFilter('all');
        addToast('📊 Filter: All levels', 'info', 2000);
      }
      
      // Refresh with 'r'
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        fetchData();
        addToast('↻ Refreshing...', 'info', 1500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, fetchData, addToast]);

  const exportCsv = () => {
    if (!flatRows.length) return;
    const rows = [['merchant', 'product', `orders_${data?.rateWindowMinutes || 5}m`, 'level']];
    for (const item of flatRows) rows.push([item.merchant, item.product, String(item.ordersInWindow), levelLabel(item.ordersInWindow)]);
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yida-products-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('⬇ CSV exported!', 'success', 2000);
  };

  const saveSettings = () => {
    localStorage.setItem('webCfg', JSON.stringify(cfg));
    addToast('💾 Settings saved!', 'success', 2000);
  };

  const totalOrders5m = merchantEntries.reduce((s, [, , sum]) => s + sum, 0);
  const activeProducts = flatRows.length;
  const hotCount = flatRows.filter(x => x.ordersInWindow >= 10).length;
  const warmCount = flatRows.filter(x => x.ordersInWindow >= 3 && x.ordersInWindow < 10).length;
  const changedRows = flatRows.filter((row) => changedKeys.has(`${row.merchant}|||${row.product}`));
  const topAlerts = changedRows
    .slice()
    .sort((a, b) => b.ordersInWindow - a.ordersInWindow)
    .slice(0, 4);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const hottestMerchant = merchantEntries[0]?.[0] || '-';
  const hottestProduct = flatRows[0] || { merchant: '-', product: '-', ordersInWindow: 0 };
  const freshnessSec = lastOkAt ? Math.max(0, Math.floor((Date.now() - new Date(lastOkAt).getTime()) / 1000)) : null;
  const partialData = Boolean(meta?.statTruncated || meta?.payOrderTruncated);

  return (
    <>
      <div className="bg-video" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)' }} />
      <div className="bg-overlay" style={{ background: 'rgba(2, 6, 23, 0.72)' }} />
      
      {/* Toast Notifications */}
      <div className="toast-container" role="alert" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
            {toast.message}
          </div>
        ))}
      </div>
      
      <div className="wrap">
        <div className="hero">
          <div>
            <h1>⚡ 易达支付产品状态 Dashboard</h1>
            <p>Realtime theo merchant • Ưu tiên đọc nhanh • Auto refresh 20s</p>
          </div>
          <div className="hero-actions">
            <span className={`health ${health.state}`} role="status" aria-label={`API status: ${health.state}`}>
              API {health.state.toUpperCase()} {health.latencyMs ? `• ${health.latencyMs}ms` : ''}
            </span>
            {partialData && <span className="stale" role="status">PARTIAL DATA</span>}
            <button onClick={fetchData} className={refreshing ? 'bounce' : ''} aria-label="Refresh data">↻ Refresh</button>
            <button onClick={exportCsv} aria-label="Export to CSV">⬇ CSV</button>
            <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
              {isFullscreen ? '⬜ Exit' : '🖥 Fullscreen'}
            </button>
          </div>
        </div>

        <div className="summary card" style={{ marginBottom: 12 }} role="region" aria-label="Summary statistics">
          <div className="kpi-card primary" role="status">
            <span>📊 Orders / {data?.rateWindowMinutes || 5}m</span>
            <b>{totalOrders5m}</b>
            <small>Total live flow trong cửa sổ hiện tại</small>
          </div>
          <div className="kpi-card" role="status">
            <span>🏢 Active merchants</span>
            <b>{merchantEntries.length}</b>
            <small>Merchant còn hoạt động gần đây</small>
          </div>
          <div className="kpi-card" role="status">
            <span>🧩 Active products</span>
            <b>{activeProducts}</b>
            <small>Sản phẩm đang có movement</small>
          </div>
          <div className="kpi-card" role="status">
            <span>🔥 Hot / Warm</span>
            <b>{hotCount} / {warmCount}</b>
            <small>Hot & warm pairs đang chạy</small>
          </div>
          <div className="kpi-card accent" role="status">
            <span>🕒 Freshness</span>
            <b>{freshnessSec === null ? '-' : `${freshnessSec}s`}</b>
            <small>{freshnessSec === null ? 'Chưa sync' : 'Từ lần sync thành công gần nhất'}</small>
          </div>
        </div>

        {topAlerts.length > 0 && (
          <div className="card alert-strip" style={{ marginBottom: 12 }} role="region" aria-label="Recent changes alerts">
            <div className="alert-strip-title">⚡ Mini alerts: merchant/product vừa thay đổi mạnh</div>
            <div className="alert-strip-list">
              {topAlerts.map((row) => (
                <div className={`alert-chip ${row.level}`} key={`${row.merchant}|||${row.product}`} role="status">
                  <strong>{row.merchant}</strong>
                  <span>{row.product}</span>
                  <b>{row.ordersInWindow}/{data.rateWindowMinutes}m</b>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="stats" style={{ marginBottom: 12 }} role="region" aria-label="Detailed statistics">
          <div className="stat" role="status"><span>🏆 Merchant hot nhất</span><b>{hottestMerchant}</b></div>
          <div className="stat" role="status"><span>⚡ Product hot nhất</span><b>{hottestProduct.product} ({hottestProduct.ordersInWindow}/{data?.rateWindowMinutes || 5}m)</b></div>
          <div className="stat" role="status"><span>🔴 Stopped merchants</span><b>{stoppedMerchants.length}</b></div>
          <div className="stat" role="status"><span>🧠 Data status</span><b>{partialData ? 'Partial' : 'Full'}</b></div>
        </div>

        <div className="card" style={{ marginBottom: 12 }} role="region" aria-label="API configuration">
          <div className="row">
            <div className="name">
              <label htmlFor="token-input">Token</label>
            </div>
            <input 
              id="token-input"
              type={tokenVisible ? 'text' : 'password'} 
              value={cfg.token} 
              onChange={e => setCfg({ ...cfg, token: e.target.value })} 
              placeholder="Paste x-product-token nếu không dùng token từ env backend"
              aria-describedby="token-help"
            />
          </div>
          <div className="row">
            <div className="name">
              <label htmlFor="internal-key-input">Internal Key</label>
            </div>
            <input 
              id="internal-key-input"
              type={internalKeyVisible ? 'text' : 'password'} 
              value={cfg.internalKey} 
              onChange={e => setCfg({ ...cfg, internalKey: e.target.value })} 
              placeholder="Paste x-internal-key nếu backend yêu cầu"
              aria-describedby="internal-key-help"
            />
          </div>
          <div className="hero-actions" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setTokenVisible(v => !v)} aria-pressed={tokenVisible}>
              {tokenVisible ? '🙈 Hide token' : '👁 Show token'}
            </button>
            <button onClick={() => setInternalKeyVisible(v => !v)} aria-pressed={internalKeyVisible}>
              {internalKeyVisible ? '🙈 Hide internal key' : '🔐 Show internal key'}
            </button>
            <button onClick={saveSettings}>💾 Save</button>
            <button onClick={fetchData}>🧪 Test</button>
          </div>
        </div>

        <div className="toolbar card sticky-toolbar" style={{ marginBottom: 12, display: 'grid', gap: 10 }} role="search">
          <input 
            placeholder="Tìm merchant/product..." 
            value={query} 
            onChange={e => setQuery(e.target.value)}
            aria-label="Search merchant or product"
          />
          <div className="hero-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <label className="chk">
              <input 
                type="checkbox" 
                checked={activeOnly} 
                onChange={e => setActiveOnly(e.target.checked)}
                aria-checked={activeOnly}
              /> Merchant active only
            </label>
            <label className="chk">
              Sort:&nbsp;
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort by">
                <option value="orders">Orders</option>
                <option value="name">Name</option>
                <option value="products">Product count</option>
              </select>
            </label>
            <label className="chk">
              Level:&nbsp;
              <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} aria-label="Filter by level">
                <option value="all">All</option>
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="idle">Idle</option>
              </select>
            </label>
            <label className="chk">
              View:&nbsp;
              <select value={viewMode} onChange={e => setViewMode(e.target.value)} aria-label="View mode">
                <option value="table">Table</option>
                <option value="cards">Cards</option>
              </select>
            </label>
            <label className="chk">
              <input 
                type="checkbox" 
                checked={cfg.soundEnabled} 
                onChange={e => setCfg({ ...cfg, soundEnabled: e.target.checked })}
                aria-checked={cfg.soundEnabled}
              /> 🔔 Sound
            </label>
            <label className="chk">
              <input 
                type="checkbox" 
                checked={cfg.toastEnabled} 
                onChange={e => setCfg({ ...cfg, toastEnabled: e.target.checked })}
                aria-checked={cfg.toastEnabled}
              /> 💬 Toasts
            </label>
            <label className="chk">
              <input 
                type="checkbox" 
                checked={showLevelLabels} 
                onChange={e => setShowLevelLabels(e.target.checked)}
                aria-checked={showLevelLabels}
              /> 🏷 Labels
            </label>
            {!!lastOkAt && <span className="ok" role="status">Last OK: {new Date(lastOkAt).toLocaleTimeString()}</span>}
            {stale && <span className="stale" role="alert">STALE DATA</span>}
          </div>
        </div>

        {loading && <p role="status">Loading...</p>}
        {error && <p className="err" role="alert">Error: {error}</p>}

        {data && viewMode === 'table' && (
          <div className="card fade-in" style={{ marginBottom: 16, overflowX: 'auto' }} role="region" aria-label="Products table">
            <h3 style={{ marginBottom: 12 }}>📋 Running products table</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }} role="table">
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                  <th style={{ padding: '10px 8px' }} scope="col">Level</th>
                  <th style={{ padding: '10px 8px' }} scope="col">Merchant</th>
                  <th style={{ padding: '10px 8px' }} scope="col">Product</th>
                  <th style={{ padding: '10px 8px' }} scope="col">Orders / {data.rateWindowMinutes}m</th>
                  <th style={{ padding: '10px 8px' }} scope="col">Merchant total</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((row, idx) => {
                  const rowKey = `${row.merchant}|||${row.product}`;
                  const isFocused = idx === focusedIndex;
                  return (
                    <tr 
                      key={rowKey} 
                      className={`${changedKeys.has(rowKey) ? 'changed' : ''} ${isFocused ? 'focused' : ''}`}
                      data-row-index={idx}
                      tabIndex={0}
                      role="row"
                      aria-selected={isFocused}
                      onFocus={() => setFocusedIndex(idx)}
                      onClick={() => setFocusedIndex(idx)}
                      style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}
                    >
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <LevelIcon n={row.ordersInWindow} showLabel={showLevelLabels} />
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>{row.merchant}</td>
                      <td style={{ padding: '10px 8px' }}>{row.product}</td>
                      <td style={{ padding: '10px 8px' }}><span className={`rate ${row.level}`}>{row.ordersInWindow}</span></td>
                      <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{row.merchantOrders}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && viewMode === 'cards' && (
          <div className="grid" role="region" aria-label="Products cards view">
            {merchantEntries.map(([merchant, items, sumOrders], idx) => (
              <div className="card fade-in" key={merchant} role="article" aria-label={`Merchant: ${merchant}`}>
                <h3>{idx < 3 ? `🏆 ${merchant}` : merchant} <small style={{color:'#64748b'}}>({sumOrders})</small></h3>
                {items.slice(0, 6).map((x, i) => {
                  const rowKey = `${merchant}|||${x.product}`;
                  const cls = `row lvl-row ${levelClass(x.ordersInWindow)} ${changedKeys.has(rowKey) ? 'changed' : ''}`;
                  return (
                    <div className={cls} key={i} role="listitem">
                      <div className="name">
                        <LevelIcon n={x.ordersInWindow} showLabel={showLevelLabels} />
                        <span>{x.product}</span>
                      </div>
                      <div className="rate">{x.ordersInWindow}/{data.rateWindowMinutes}m</div>
                    </div>
                  );
                })}
                {items.length > 6 && <p style={{ color: '#94a3b8', marginTop: 8 }}>+ {items.length - 6} products khác</p>}
              </div>
            ))}
          </div>
        )}

        {stoppedMerchants.length > 0 && (
          <div className="stopped-section card" style={{ marginTop: 16 }} role="region" aria-label="Stopped merchants">
            <div className="hero-actions" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>🔴 Merchant đang dừng ({stoppedMerchants.length})</h3>
              <button onClick={() => setShowStopped(v => !v)} aria-expanded={showStopped} aria-controls="stopped-list">
                {showStopped ? 'Hide' : 'Show'}
              </button>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 8px' }}>Không có product nào chạy trong 10 phút qua</p>
            {showStopped && (
              <div className="stopped-list" id="stopped-list" role="list">
                {stoppedMerchants.map(([merchant,,, , totalProducts]) => (
                  <span className="stopped-tag" key={merchant} role="listitem">{merchant} <small>({totalProducts} products)</small></span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Keyboard shortcuts help */}
        <div className="card" style={{ marginTop: 16 }} role="region" aria-label="Keyboard shortcuts">
          <h3 style={{ marginBottom: 8 }}>⌨️ Keyboard Shortcuts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 13 }}>
            <div><kbd>↑</kbd> <kbd>↓</kbd> Navigate rows</div>
            <div><kbd>Enter</kbd> Select focused row</div>
            <div><kbd>Esc</kbd> Clear focus</div>
            <div><kbd>R</kbd> Refresh data</div>
            <div><kbd>H</kbd> Filter: Hot</div>
            <div><kbd>W</kbd> Filter: Warm</div>
            <div><kbd>I</kbd> Filter: Idle</div>
            <div><kbd>A</kbd> Filter: All</div>
          </div>
        </div>
      </div>
    </>
  );
}
