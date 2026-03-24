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

const defaultCfg = {
  apiBase: 'https://yida-new-mgr-omnxqgbi-api.yznba.com',
  origin: 'https://yida-new-mgr-y5cf7h6r.yznba.com',
  token: '',
  maxPages: 20,
  rateWindowMinutes: 5
};

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastOkAt, setLastOkAt] = useState('');
  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [health, setHealth] = useState({ state: 'idle', latencyMs: 0 });
  const [stale, setStale] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [changedKeys, setChangedKeys] = useState(new Set());
  const prevMapRef = useRef(new Map());
  const lastActiveRef = useRef(new Map());
  // Backend đã kiểm tra rateWindowMinutes (5 phút), nên frontend chỉ cần đợi thêm 5 phút
  // Tổng = rateWindow (5) + frontend (5) = 10 phút
  const INACTIVE_MS = 5 * 60 * 1000;
  const [cfg, setCfg] = useState(() => {
    const saved = localStorage.getItem('desktopCfg');
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
          if (window.desktopAPI?.getRunningProducts) {
            json = await Promise.race([
              window.desktopAPI.getRunningProducts(cfg),
              new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout desktop API')), 10000))
            ]);
          } else {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const url = cfg.token ? `${API_URL}?token=${encodeURIComponent(cfg.token)}` : API_URL;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Fetch failed');
          }

          if (!json?.data || typeof json.data !== 'object') {
            throw new Error('API trả dữ liệu rỗng/không hợp lệ');
          }

          break;
        } catch (e) {
          lastErr = e;
          if (attempt < 2) await new Promise(r => setTimeout(r, 700));
        }
      }

      if (!json) throw lastErr || new Error('Fetch failed');

      const latencyMs = Math.round(performance.now() - t0);
      setData(json);
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
    localStorage.setItem('desktopCfg', JSON.stringify(cfg));
  }, [cfg]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 20000);
    return () => clearInterval(id);
  }, [fetchData]);

  const safeData = useMemo(() => (
    data?.data && typeof data.data === 'object' ? data.data : {}
  ), [data]);

  // Track last active time per product
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

  const merchantEntries = useMemo(() => runningMerchants
    .filter(([merchant, items, sumOrders]) => {
      const q = query.trim().toLowerCase();
      const hit = !q || merchant.toLowerCase().includes(q) || items.some(x => x.product.toLowerCase().includes(q));
      const activeHit = !activeOnly || sumOrders > 0;
      return hit && activeHit;
    })
    .sort((a, b) => b[2] - a[2]), [runningMerchants, query, activeOnly]);

  useEffect(() => {
    const next = new Map();
    const changed = new Set();
    for (const [merchant, items] of merchantEntries) {
      for (const item of items) {
        const key = `${merchant}|||${item.product}`;
        const prev = prevMapRef.current.get(key);
        next.set(key, item.ordersInWindow);
        if (prev !== undefined && prev !== item.ordersInWindow) changed.add(key);
      }
    }
    prevMapRef.current = next;
    setChangedKeys(changed);
    if (changed.size) {
      const t = setTimeout(() => setChangedKeys(new Set()), 900);
      return () => clearTimeout(t);
    }
  }, [merchantEntries]);

  const exportCsv = () => {
    if (!merchantEntries.length) return;
    const rows = [['merchant', 'product', `orders_${data?.rateWindowMinutes || 5}m`]];
    for (const [merchant, items] of merchantEntries) {
      for (const item of items) rows.push([merchant, item.product, String(item.ordersInWindow)]);
    }
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
    localStorage.setItem('desktopCfg', JSON.stringify(cfg));
  };

  const totalOrders5m = merchantEntries.reduce((s, [, , sum]) => s + sum, 0);

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
  const hottestProduct = (() => {
    let best = { merchant: '-', product: '-', n: -1 };
    for (const [merchant, items] of merchantEntries) {
      for (const item of items) {
        if (item.ordersInWindow > best.n) best = { merchant, product: item.product, n: item.ordersInWindow };
      }
    }
    return best;
  })();

  return (
    <>
      <video className="bg-video" autoPlay muted loop playsInline src="https://motionbgs.com/media/9275/reze-blue-butterfly.960x540.mp4" />
      <div className="bg-overlay" />
      <div className="wrap">
        <div className="hero">
          <div>
            <h1>⚡ 易达支付产品状态-Real Time</h1>
            <p>Realtime theo merchant • Auto refresh 20s</p>
          </div>
          <div className="hero-actions">
            <span className={`health ${health.state}`}>API {health.state.toUpperCase()} {health.latencyMs ? `• ${health.latencyMs}ms` : ''}</span>
            <button onClick={fetchData} className={refreshing ? 'bounce' : ''}>↻ Refresh now</button>
            <button onClick={exportCsv}>⬇ Export CSV</button>
            <button onClick={toggleFullscreen}>{isFullscreen ? '⬜ Exit Fullscreen' : '🖥 Fullscreen'}</button>
            {window.desktopAPI?.checkUpdatesNow && <button onClick={() => window.desktopAPI.checkUpdatesNow()}>🆙 Check update now</button>}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          {window.desktopAPI?.getRunningProducts && (
            <>
              <div className="row"><div className="name">API Base</div><input value={cfg.apiBase} onChange={e => setCfg({ ...cfg, apiBase: e.target.value })} /></div>
              <div className="row"><div className="name">Origin</div><input value={cfg.origin} onChange={e => setCfg({ ...cfg, origin: e.target.value })} /></div>
            </>
          )}
          <div className="row"><div className="name">Token</div><input type={tokenVisible ? 'text' : 'password'} value={cfg.token} onChange={e => setCfg({ ...cfg, token: e.target.value })} placeholder="Paste itoken mới nếu bị 401" /></div>
          <div className="hero-actions" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setTokenVisible(v => !v)}>{tokenVisible ? '🙈 Hide token' : '👁 Show token'}</button>
            <button onClick={saveSettings}>💾 Save</button>
            <button onClick={fetchData}>🧪 Test connection</button>
          </div>
        </div>

        <div className="toolbar card sticky-toolbar" style={{ marginBottom: 12 }}>
          <input placeholder="Tìm merchant/product..." value={query} onChange={e => setQuery(e.target.value)} />
          <label className="chk"><input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} /> Chỉ hiện merchant active</label>
          {!!lastOkAt && <span className="ok">Last OK: {new Date(lastOkAt).toLocaleTimeString()}</span>}
          {stale && <span className="stale">STALE DATA</span>}
        </div>

        {loading && <p>Loading...</p>}
        {error && <p className="err">Error: {error}</p>}

        {data && (
          <>
            <div className="summary card" style={{ marginBottom: 12 }}>
              <div><span>🔥 Merchant hot nhất</span><b>{hottestMerchant}</b></div>
              <div><span>⚡ Product hot nhất</span><b>{hottestProduct.product} ({hottestProduct.n >= 0 ? hottestProduct.n : 0}/{data.rateWindowMinutes}m)</b></div>
              <div><span>📊 Tổng đơn toàn hệ thống</span><b>{totalOrders5m}/{data.rateWindowMinutes}m</b></div>
            </div>

            <div className="stats">
              <div className="stat"><span>🕒 Updated</span><b>{new Date(data.fetchedAt).toLocaleTimeString()}</b></div>
              <div className="stat"><span>⏱ Window</span><b>{data.rateWindowMinutes} phút</b></div>
              <div className="stat"><span>🏢 Merchants</span><b>{merchantEntries.length}/{data.merchantCount}</b></div>
              <div className="stat"><span>🧩 Pairs</span><b>{data.pairCount}</b></div>
            </div>

            <div className="grid">
              {merchantEntries.map(([merchant, items, sumOrders], idx) => (
                <div className="card fade-in" key={merchant}>
                  <h3>{idx < 3 ? `🏆 ${merchant}` : merchant} <small style={{color:'#64748b'}}>({sumOrders})</small></h3>
                  {items.map((x, i) => {
                    const rowKey = `${merchant}|||${x.product}`;
                    const cls = `row lvl-row ${levelClass(x.ordersInWindow)} ${changedKeys.has(rowKey) ? 'changed' : ''}`;
                    return (
                      <div className={cls} key={i}>
                        <div className="name"><span className={`lvl ${levelClass(x.ordersInWindow)}`}><LevelIcon n={x.ordersInWindow} /></span> {x.product}</div>
                        <div className="rate">{x.ordersInWindow}/{data.rateWindowMinutes}m</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {stoppedMerchants.length > 0 && (
              <div className="stopped-section card" style={{ marginTop: 16 }}>
                <h3>🔴 Merchant đang dừng ({stoppedMerchants.length})</h3>
                <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 8px' }}>Không có product nào chạy trong 10 phút qua</p>
                <div className="stopped-list">
                  {stoppedMerchants.map(([merchant,,, , totalProducts]) => (
                    <span className="stopped-tag" key={merchant}>{merchant} <small>({totalProducts} products)</small></span>
                  ))}
                </div>
              </div>
            )}

            <div className="running-summary card" style={{ marginTop: 12 }}>
              <h3>🟢 Merchant đang chạy ({runningMerchants.length})</h3>
              <div className="stopped-list">
                {runningMerchants.map(([merchant,, sumOrders]) => (
                  <span className="running-tag" key={merchant}>{merchant} <small>({sumOrders})</small></span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
