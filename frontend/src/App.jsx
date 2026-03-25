import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_URL = 'http://localhost:8787/api/running-products';
const HOT_VIDEO = `${import.meta.env.BASE_URL}hot-icon.mp4`;
const WARM_VIDEO = `${import.meta.env.BASE_URL}warm-icon.mp4`;
const IDLE_VIDEO = `${import.meta.env.BASE_URL}idle-icon.mp4`;

function LevelIcon({ n }) {
  const [failed, setFailed] = useState(false);

  if (n >= 10) {
    if (failed) return '🔥';
    return <video className="hot-gif" src={HOT_VIDEO} autoPlay muted loop playsInline onError={() => setFailed(true)} />;
  }
  if (n >= 3) {
    if (failed) return '🟢';
    return <video className="warm-gif" src={WARM_VIDEO} autoPlay muted loop playsInline onError={() => setFailed(true)} />;
  }

  if (failed) return '⚪';
  return <video className="idle-gif" src={IDLE_VIDEO} autoPlay muted loop playsInline onError={() => setFailed(true)} />;
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
  internalKey: ''
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
  const prevMapRef = useRef(new Map());
  const lastActiveRef = useRef(new Map());
  const INACTIVE_MS = 5 * 60 * 1000;
  const [cfg, setCfg] = useState(() => {
    const saved = localStorage.getItem('webCfg');
    return saved ? { ...defaultCfg, ...JSON.parse(saved) } : defaultCfg;
  });

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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cfg]);

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
  };

  const saveSettings = () => {
    localStorage.setItem('webCfg', JSON.stringify(cfg));
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
      <div className="wrap">
        <div className="hero">
          <div>
            <h1>⚡ 易达支付产品状态 Dashboard</h1>
            <p>Realtime theo merchant • Ưu tiên đọc nhanh • Auto refresh 20s</p>
          </div>
          <div className="hero-actions">
            <span className={`health ${health.state}`}>API {health.state.toUpperCase()} {health.latencyMs ? `• ${health.latencyMs}ms` : ''}</span>
            {partialData && <span className="stale">PARTIAL DATA</span>}
            <button onClick={fetchData} className={refreshing ? 'bounce' : ''}>↻ Refresh</button>
            <button onClick={exportCsv}>⬇ CSV</button>
            <button onClick={toggleFullscreen}>{isFullscreen ? '⬜ Exit' : '🖥 Fullscreen'}</button>
          </div>
        </div>

        <div className="summary card" style={{ marginBottom: 12 }}>
          <div className="kpi-card primary"><span>📊 Orders / {data?.rateWindowMinutes || 5}m</span><b>{totalOrders5m}</b><small>Total live flow trong cửa sổ hiện tại</small></div>
          <div className="kpi-card"><span>🏢 Active merchants</span><b>{merchantEntries.length}</b><small>Merchant còn hoạt động gần đây</small></div>
          <div className="kpi-card"><span>🧩 Active products</span><b>{activeProducts}</b><small>Sản phẩm đang có movement</small></div>
          <div className="kpi-card"><span>🔥 Hot / Warm</span><b>{hotCount} / {warmCount}</b><small>Hot & warm pairs đang chạy</small></div>
          <div className="kpi-card accent"><span>🕒 Freshness</span><b>{freshnessSec === null ? '-' : `${freshnessSec}s`}</b><small>{freshnessSec === null ? 'Chưa sync' : 'Từ lần sync thành công gần nhất'}</small></div>
        </div>

        {topAlerts.length > 0 && (
          <div className="card alert-strip" style={{ marginBottom: 12 }}>
            <div className="alert-strip-title">⚡ Mini alerts: merchant/product vừa thay đổi mạnh</div>
            <div className="alert-strip-list">
              {topAlerts.map((row) => (
                <div className={`alert-chip ${row.level}`} key={`${row.merchant}|||${row.product}`}>
                  <strong>{row.merchant}</strong>
                  <span>{row.product}</span>
                  <b>{row.ordersInWindow}/{data.rateWindowMinutes}m</b>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="stats" style={{ marginBottom: 12 }}>
          <div className="stat"><span>🏆 Merchant hot nhất</span><b>{hottestMerchant}</b></div>
          <div className="stat"><span>⚡ Product hot nhất</span><b>{hottestProduct.product} ({hottestProduct.ordersInWindow}/{data?.rateWindowMinutes || 5}m)</b></div>
          <div className="stat"><span>🔴 Stopped merchants</span><b>{stoppedMerchants.length}</b></div>
          <div className="stat"><span>🧠 Data status</span><b>{partialData ? 'Partial' : 'Full'}</b></div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row"><div className="name">Token</div><input type={tokenVisible ? 'text' : 'password'} value={cfg.token} onChange={e => setCfg({ ...cfg, token: e.target.value })} placeholder="Paste x-product-token nếu không dùng token từ env backend" /></div>
          <div className="row"><div className="name">Internal Key</div><input type={internalKeyVisible ? 'text' : 'password'} value={cfg.internalKey} onChange={e => setCfg({ ...cfg, internalKey: e.target.value })} placeholder="Paste x-internal-key nếu backend yêu cầu" /></div>
          <div className="hero-actions" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setTokenVisible(v => !v)}>{tokenVisible ? '🙈 Hide token' : '👁 Show token'}</button>
            <button onClick={() => setInternalKeyVisible(v => !v)}>{internalKeyVisible ? '🙈 Hide internal key' : '🔐 Show internal key'}</button>
            <button onClick={saveSettings}>💾 Save</button>
            <button onClick={fetchData}>🧪 Test</button>
          </div>
        </div>

        <div className="toolbar card sticky-toolbar" style={{ marginBottom: 12, display: 'grid', gap: 10 }}>
          <input placeholder="Tìm merchant/product..." value={query} onChange={e => setQuery(e.target.value)} />
          <div className="hero-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <label className="chk"><input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} /> Merchant active only</label>
            <label className="chk">Sort:&nbsp;
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="orders">Orders</option>
                <option value="name">Name</option>
                <option value="products">Product count</option>
              </select>
            </label>
            <label className="chk">Level:&nbsp;
              <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="idle">Idle</option>
              </select>
            </label>
            <label className="chk">View:&nbsp;
              <select value={viewMode} onChange={e => setViewMode(e.target.value)}>
                <option value="table">Table</option>
                <option value="cards">Cards</option>
              </select>
            </label>
            {!!lastOkAt && <span className="ok">Last OK: {new Date(lastOkAt).toLocaleTimeString()}</span>}
            {stale && <span className="stale">STALE DATA</span>}
          </div>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p className="err">Error: {error}</p>}

        {data && viewMode === 'table' && (
          <div className="card fade-in" style={{ marginBottom: 16, overflowX: 'auto' }}>
            <h3 style={{ marginBottom: 12 }}>📋 Running products table</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                  <th style={{ padding: '10px 8px' }}>Level</th>
                  <th style={{ padding: '10px 8px' }}>Merchant</th>
                  <th style={{ padding: '10px 8px' }}>Product</th>
                  <th style={{ padding: '10px 8px' }}>Orders / {data.rateWindowMinutes}m</th>
                  <th style={{ padding: '10px 8px' }}>Merchant total</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((row) => {
                  const rowKey = `${row.merchant}|||${row.product}`;
                  return (
                    <tr key={rowKey} className={changedKeys.has(rowKey) ? 'changed' : ''} style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`lvl ${row.level}`}><LevelIcon n={row.ordersInWindow} /></span>
                          <span className={`level-chip ${row.level}`}>{levelLabel(row.ordersInWindow)}</span>
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
          <div className="grid">
            {merchantEntries.map(([merchant, items, sumOrders], idx) => (
              <div className="card fade-in" key={merchant}>
                <h3>{idx < 3 ? `🏆 ${merchant}` : merchant} <small style={{color:'#64748b'}}>({sumOrders})</small></h3>
                {items.slice(0, 6).map((x, i) => {
                  const rowKey = `${merchant}|||${x.product}`;
                  const cls = `row lvl-row ${levelClass(x.ordersInWindow)} ${changedKeys.has(rowKey) ? 'changed' : ''}`;
                  return (
                    <div className={cls} key={i}>
                      <div className="name">
                        <span className={`lvl ${levelClass(x.ordersInWindow)}`}><LevelIcon n={x.ordersInWindow} /></span>
                        <span>{x.product}</span>
                        <span className={`level-chip ${levelClass(x.ordersInWindow)}`}>{levelLabel(x.ordersInWindow)}</span>
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
          <div className="stopped-section card" style={{ marginTop: 16 }}>
            <div className="hero-actions" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>🔴 Merchant đang dừng ({stoppedMerchants.length})</h3>
              <button onClick={() => setShowStopped(v => !v)}>{showStopped ? 'Hide' : 'Show'}</button>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 8px' }}>Không có product nào chạy trong 10 phút qua</p>
            {showStopped && (
              <div className="stopped-list">
                {stoppedMerchants.map(([merchant,,, , totalProducts]) => (
                  <span className="stopped-tag" key={merchant}>{merchant} <small>({totalProducts} products)</small></span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
