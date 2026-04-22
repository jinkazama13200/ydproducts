import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTableState } from './hooks/useTableState';
import { EnhancedTable } from './components/EnhancedTable';
import { ErrorState } from './components/ErrorState';
import { Skeleton, SkeletonKPI, SkeletonTableRow, SkeletonCardGrid, SkeletonToolbar } from './components/Skeleton';
import { ConnectionStatus } from './components/ConnectionStatus';
import { SettingsModal } from './components/SettingsModal';
import { KpiStrip } from './components/KpiStrip';
import { StoppedMerchants } from './components/StoppedMerchants';
import { CardView } from './components/CardView';
import { LevelIcon } from './components/LevelIcon';
import { useDashboardData } from './hooks/useDashboardData';
import { useFilters } from './hooks/useFilters';
import { useSearchHistory } from './hooks/useSearchHistory';
import { useFilterPresets, DEFAULT_PRESETS } from './hooks/useFilterPresets';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useFullscreen } from './hooks/useFullscreen';
import { levelClass, levelLabel } from './utils/levels';
import { saveConfig } from './utils/storage';
import { buttonVariants } from './utils/animations';

function AppInner() {
  // === Hooks ===
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dashboard = useDashboardData(addToast);
  const filters = useFilters();
  const search = useSearchHistory();
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [internalKeyVisible, setInternalKeyVisible] = useState(false);
  const [showStopped, setShowStopped] = useState(false);
  const [showLevelLabels, setShowLevelLabels] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(true);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const rowsRef = useRef([]);

  const presetManager = useFilterPresets({
    onLoadPreset: (preset) => {
      if (preset.filters.query) filters.setQuery(preset.filters.query);
      if (preset.filters.activeOnly !== undefined) filters.setActiveOnly(preset.filters.activeOnly);
      if (preset.filters.sortBy) filters.setSortBy(preset.filters.sortBy);
      if (preset.filters.viewMode) filters.setViewMode(preset.filters.viewMode);
      if (preset.filters.levelFilter) filters.setLevelFilter(preset.filters.levelFilter);
      if (preset.filters.minOrders !== undefined) filters.setMinOrders(preset.filters.minOrders);
      if (preset.filters.merchantFilter) filters.setMerchantFilter(preset.filters.merchantFilter);
      addToast(`📌 Loaded: ${preset.name}`, 'success', 2000);
    },
    addToast,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onRefresh: dashboard.fetchData,
    onClearFilters: () => {
      filters.clearAllFilters();
      addToast('🧹 All filters cleared', 'success', 2000);
    },
    onLevelFilter: (level) => {
      filters.setLevelFilter(level);
      addToast(`${level === 'hot' ? '🔥' : level === 'warm' ? '🟢' : level === 'idle' ? '⚪' : '📊'} Filter: ${level.charAt(0).toUpperCase() + level.slice(1)} only`, 'info', 2000);
    },
    onSearchFocus: () => {
      searchInputRef.current?.focus();
      search.setShowSearchHistory(true);
      addToast('🔍 Search focused', 'info', 1500);
    },
    onSettingsOpen: () => setSettingsOpen(true),
    onEscape: () => {
      setFocusedIndex(-1);
      search.setShowSearchHistory(false);
      presetManager.setShowPresets(false);
    },
    onArrowDown: () => {
      const rows = rowsRef.current;
      if (rows.length === 0) return;
      setFocusedIndex(prev => prev < rows.length - 1 ? prev + 1 : 0);
    },
    onArrowUp: () => {
      const rows = rowsRef.current;
      if (rows.length === 0) return;
      setFocusedIndex(prev => prev > 0 ? prev - 1 : rows.length - 1);
    },
    onEnter: () => {
      if (focusedIndex < 0) return;
      const row = rowsRef.current[focusedIndex];
      if (row) addToast(`📌 ${row.merchant} - ${row.product}: ${row.ordersInWindow} đơn`, 'info', 3000);
    },
  });

  // === Derived data ===
  const merchantEntries = useMemo(() => {
    const filtered = dashboard.runningMerchants
      .map(([merchant, items, sumOrders, inactive, totalProducts]) => {
        const filteredItems = items.filter((x) => {
          const q = filters.query.trim().toLowerCase();
          const m = filters.merchantFilter.trim().toLowerCase();
          const queryHit = !q || merchant.toLowerCase().includes(q) || (x?.product || '').toLowerCase().includes(q);
          const merchantHit = !m || merchant.toLowerCase().includes(m);
          const levelHit = filters.levelFilter === 'all' || levelClass(x?.ordersInWindow || 0) === filters.levelFilter;
          const ordersHit = (x?.ordersInWindow || 0) >= filters.minOrders;
          return queryHit && merchantHit && levelHit && ordersHit;
        });
        const nextSumOrders = filteredItems.reduce((s, x) => s + (x?.ordersInWindow || 0), 0);
        return [merchant, filteredItems, nextSumOrders, inactive, totalProducts];
      })
      .filter(([merchant, items, sumOrders]) => {
        const q = filters.query.trim().toLowerCase();
        const merchantHit = !q || merchant.toLowerCase().includes(q) || items.length > 0;
        const activeHit = !filters.activeOnly || sumOrders > 0;
        return merchantHit && activeHit && items.length > 0;
      });

    filtered.sort((a, b) => {
      if (filters.sortBy === 'name') return a[0].localeCompare(b[0]);
      if (filters.sortBy === 'products') return b[1].length - a[1].length || b[2] - a[2];
      return b[2] - a[2] || a[0].localeCompare(b[0]);
    });

    return filtered;
  }, [dashboard.runningMerchants, filters.query, filters.merchantFilter, filters.minOrders, filters.activeOnly, filters.sortBy, filters.levelFilter]);

  const flatRows = useMemo(() => {
    const rows = [];
    for (const [merchant, items, sumOrders] of merchantEntries) {
      for (const item of items) {
        rows.push({
          merchant,
          merchantOrders: sumOrders,
          ...item,
          level: levelClass(item?.ordersInWindow || 0)
        });
      }
    }
    return rows.sort((a, b) => {
      if (filters.sortBy === 'name') return (a?.merchant || '').localeCompare(b?.merchant || '') || (a?.product || '').localeCompare(b?.product || '');
      if (filters.sortBy === 'products') return (b?.merchantOrders || 0) - (a?.merchantOrders || 0) || (b?.ordersInWindow || 0) - (a?.ordersInWindow || 0);
      return (b?.ordersInWindow || 0) - (a?.ordersInWindow || 0) || (b?.merchantOrders || 0) - (a?.merchantOrders || 0);
    });
  }, [merchantEntries, filters.sortBy]);

  const tableState = useTableState(flatRows || [], {
    initialPageSize: 25,
    pageSizeOptions: [25, 50, 100],
    initialSortColumn: 'ordersInWindow',
    initialSortDirection: 'desc'
  });

  // Track changed rows
  useEffect(() => {
    rowsRef.current = flatRows;
  }, [flatRows]);

  useEffect(() => {
    const next = new Map();
    const changed = new Set();
    for (const row of flatRows) {
      const key = `${row?.merchant || ''}|||${row?.product || ''}`;
      const prev = dashboard.prevMapRef.current.get(key);
      next.set(key, row?.ordersInWindow || 0);
      if (prev !== undefined && prev !== (row?.ordersInWindow || 0)) changed.add(key);
    }
    dashboard.prevMapRef.current = next;
    dashboard.setChangedKeys(changed);
    if (changed.size) {
      const t = setTimeout(() => dashboard.setChangedKeys(new Set()), 900);
      return () => clearTimeout(t);
    }
  }, [flatRows]);

  // Auto-switch view on small screen
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640 && filters.viewMode === 'table') {
        filters.setViewMode('cards');
        addToast('📱 Switched to Cards view (mobile)', 'info', 2000);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [addToast]);

  // === Computed values ===
  const totalOrders5m = merchantEntries?.reduce((s, [, , sum]) => s + (sum || 0), 0) || 0;
  const activeProducts = flatRows?.length || 0;
  const hotCount = flatRows?.filter(x => (x?.ordersInWindow || 0) >= 10).length || 0;
  const warmCount = flatRows?.filter(x => (x?.ordersInWindow || 0) >= 3 && (x?.ordersInWindow || 0) < 10).length || 0;
  const changedRows = flatRows?.filter((row) => dashboard.changedKeys.has(`${row?.merchant || ''}|||${row?.product || ''}`)) || [];
  const topAlerts = changedRows.slice().sort((a, b) => (b?.ordersInWindow || 0) - (a?.ordersInWindow || 0)).slice(0, 4);
  const hottestMerchant = merchantEntries[0]?.[0] || '-';
  const hottestProduct = flatRows.length > 0 ? flatRows[0] : { merchant: '-', product: '-', ordersInWindow: 0 };
  const freshnessSec = dashboard.lastOkAt ? Math.max(0, Math.floor((Date.now() - new Date(dashboard.lastOkAt).getTime()) / 1000)) : null;
  const partialData = Boolean(dashboard.meta?.statTruncated || dashboard.meta?.payOrderTruncated);
  const safeRateWindow = dashboard.data?.rateWindowMinutes || 5;

  // CSV export
  const exportCsv = useCallback(() => {
    try {
      if (!flatRows || flatRows.length === 0) {
        addToast('⚠️ No data to export', 'warning', 2000);
        return;
      }
      const csvRows = [['merchant', 'product', 'orders', 'level']];
      for (const item of flatRows) {
        csvRows.push([
          item?.merchant || 'Unknown',
          item?.product || 'Unknown',
          String(item?.ordersInWindow || 0),
          levelLabel(item?.ordersInWindow || 0)
        ]);
      }
      const csv = csvRows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'yida-products-' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('⬇ CSV exported!', 'success', 2000);
    } catch (error) {
      addToast('❌ Export failed: ' + (error?.message || 'Unknown error'), 'error', 5000);
    }
  }, [flatRows, addToast]);

  const saveSettings = useCallback(() => {
    saveConfig(dashboard.cfg);
    addToast('💾 Settings saved!', 'success', 2000);
    setSettingsOpen(false);
  }, [dashboard.cfg, addToast]);

  // KPI strip data - merged KPIs + stats into single compact strip
  const kpiStripItems = [
    { icon: '📊', label: 'Orders', value: totalOrders5m || 0, primary: true },
    { icon: '🏢', label: 'Merchants', value: merchantEntries?.length || 0 },
    { icon: '🧩', label: 'Products', value: activeProducts || 0 },
    { icon: '🔥', label: 'Hot/Warm', value: `${hotCount || 0}/${warmCount || 0}` },
    { icon: '🕒', label: 'Fresh', value: freshnessSec === null ? '-' : `${freshnessSec}s`, accent: true },
    { icon: '🏆', label: 'Top', value: hottestMerchant === '-' ? '-' : hottestMerchant.length > 12 ? hottestMerchant.slice(0, 12) + '…' : hottestMerchant },
    { icon: '🔴', label: 'Stopped', value: dashboard.stoppedMerchants.length },
    { icon: '🧠', label: 'Data', value: partialData ? 'Partial' : 'Full' }
  ];

  // Alert pills - only show when there are changes
  const alertPills = topAlerts && topAlerts.length > 0
    ? topAlerts.slice(0, 6).map((row, idx) => ({
        merchant: row.merchant,
        product: row.product,
        orders: row.ordersInWindow || 0,
        level: row.level || levelClass(row.ordersInWindow || 0)
      }))
    : [];

  return (
    <>
      {/* Toast Notifications */}
      <div className="toast-container" role="alert" aria-live="polite" aria-atomic="true">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              className={`toast toast-${toast.type}`}
              role="status"
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <button className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">✕</button>
              {toast.message}
              <div
                className="toast-progress"
                style={{
                  animationDuration: `${toast.duration || 4000}ms`,
                  background: toast.type === 'hot' ? 'rgba(255,59,48,0.6)' :
                    toast.type === 'error' ? 'rgba(255,59,48,0.6)' :
                    toast.type === 'success' ? 'rgba(48,209,88,0.6)' :
                    toast.type === 'warning' ? 'rgba(255,159,10,0.6)' :
                    'rgba(0,122,255,0.6)'
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        cfg={dashboard.cfg}
        setCfg={dashboard.setCfg}
        onSave={saveSettings}
        tokenVisible={tokenVisible}
        setTokenVisible={setTokenVisible}
        internalKeyVisible={internalKeyVisible}
        setInternalKeyVisible={setInternalKeyVisible}
        wsStatus={dashboard.wsStatus}
        wsCircuitBreaker={dashboard.wsCircuitBreaker}
        wsUsingCache={dashboard.wsUsingCache}
        wsLastUpdate={dashboard.wsLastUpdate}
      />

      <motion.div id="main-content" className="wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        {/* Compact Status Bar */}
        <motion.div
          className="status-bar card"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        >
          <span className="status-title">⚡ 易达支付产品状态</span>
          <div className="status-badges">
            <ConnectionStatus status={dashboard.wsStatus} circuitBreaker={dashboard.wsCircuitBreaker} usingCache={dashboard.wsUsingCache} lastUpdate={dashboard.wsLastUpdate} />
            <span className={`health ${dashboard.health.state}`} role="status"
              aria-label={`API status: ${dashboard.health.state}`}>
              {dashboard.health.state.toUpperCase()} {dashboard.health.latencyMs ? `• ${dashboard.health.latencyMs}ms` : ''}
            </span>
            {partialData && <span className="stale">PARTIAL</span>}
            {alertPills.length > 0 && (
              <div className="alert-pills">
                {alertPills.map((pill, i) => (
                  <span key={i} className={`alert-pill ${pill.level}`} title={`${pill.merchant} • ${pill.product} • ${pill.orders}/${safeRateWindow}m`}>
                    {pill.merchant} • {pill.product} <b>{pill.orders}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="status-actions">
            <motion.button onClick={dashboard.fetchData} className={dashboard.refreshing ? 'bounce' : ''}
              aria-label="Refresh data" variants={buttonVariants} whileHover="hover" whileTap="tap">↻</motion.button>
            <motion.button onClick={exportCsv} aria-label="Export to CSV" variants={buttonVariants} whileHover="hover" whileTap="tap">⬇</motion.button>
            <motion.button onClick={() => setSettingsOpen(true)} aria-label="Open settings" variants={buttonVariants} whileHover="hover" whileTap="tap">⚙️</motion.button>
            <motion.button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} variants={buttonVariants} whileHover="hover" whileTap="tap">
              {isFullscreen ? '⬜' : '🖥'}
            </motion.button>
          </div>
        </motion.div>

        {/* KPI Strip - merged KPIs + stats */}
        <KpiStrip items={kpiStripItems} />

        {/* Compact Toolbar */}
        <motion.div className="toolbar card sticky-toolbar compact" role="search"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <input
                ref={searchInputRef}
                placeholder="Tìm merchant/product... (Ctrl+K)"
                value={filters.query}
                onChange={(e) => {
                  filters.setQuery(e.target.value);
                  if (e.target.value.trim()) search.addToHistory(e.target.value.trim());
                }}
                onFocus={() => search.setShowSearchHistory(true)}
                onBlur={() => setTimeout(() => search.setShowSearchHistory(false), 200)}
                aria-label="Search merchant or product"
                style={{ width: '100%', paddingRight: 40 }}
              />
              {search.searchHistory.length > 0 && (
                <button onClick={search.clearHistory}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '4px 8px', minWidth: 'auto', background: 'transparent', boxShadow: 'none' }}
                  aria-label="Clear search history">
                  🗑️
                </button>
              )}
              <AnimatePresence>
                {search.showSearchHistory && search.searchHistory.length > 0 && (
                  <motion.div className="search-history-dropdown" role="listbox"
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                    <div className="search-history-header">Recent Searches</div>
                    {search.searchHistory.map((term, i) => (
                      <motion.div key={`search-${term}-${i}`} className="search-history-item"
                        role="option" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                        whileHover={{ backgroundColor: 'rgba(253,252,252,0.1)' }}>
                        <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => { filters.setQuery(term); search.setShowSearchHistory(false); }}>
                          🔍 {term}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); search.removeFromHistory(term); }}
                          style={{ background: 'none', border: 'none', color: '#6e6e73', cursor: 'pointer', padding: '2px 6px', fontSize: 12, minWidth: 'auto', minHeight: 'auto', boxShadow: 'none' }}>
                          ✕
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <motion.button onClick={() => setToolbarCollapsed(v => !v)}
              style={{ padding: '8px 12px', whiteSpace: 'nowrap', minWidth: 'auto', fontSize: 13 }}
              variants={buttonVariants} whileHover="hover" whileTap="tap">
              {toolbarCollapsed ? '⚙ Filters' : '✕'}
            </motion.button>
          </div>

          {!toolbarCollapsed && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
              {/* Quick Filters */}
              <div className="quick-filters" style={{ marginTop: 8 }}>
                <label className="chk">
                  <input type="checkbox" checked={filters.activeOnly} onChange={e => filters.setActiveOnly(e.target.checked)} />
                  Active only
                </label>
                <label className="chk">
                  Level:&nbsp;
                  <select value={filters.levelFilter} onChange={e => filters.setLevelFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="idle">Idle</option>
                  </select>
                </label>
                <label className="chk">
                  Sort:&nbsp;
                  <select value={filters.sortBy} onChange={e => filters.setSortBy(e.target.value)}>
                    <option value="orders">Orders</option>
                    <option value="name">Name</option>
                    <option value="products">Products</option>
                  </select>
                </label>
                <label className="chk">
                  View:&nbsp;
                  <select value={filters.viewMode} onChange={e => filters.setViewMode(e.target.value)}>
                    <option value="table">Table</option>
                    <option value="cards">Cards</option>
                  </select>
                </label>
                <button onClick={() => { filters.clearAllFilters(); addToast('🧹 Cleared', 'success', 1500); }}
                  style={{ padding: '6px 10px', minWidth: 'auto', fontSize: 12, background: 'rgba(255,59,48,0.1)', borderColor: 'rgba(255,59,48,0.3)', color: '#ff3b30' }}>
                  🧹 Clear
                </button>
              </div>

              {/* Advanced Filters */}
              <div className="advanced-filters" style={{ borderTop: '1px solid rgba(15,0,0,0.12)', paddingTop: 8, marginTop: 8 }}>
                <button onClick={() => setAdvancedFiltersOpen(v => !v)}
                  style={{ background: 'transparent', color: '#007aff', padding: '6px 0', boxShadow: 'none', width: '100%', textAlign: 'left', fontSize: 12 }}>
                  {advancedFiltersOpen ? '▼' : '▶'} Advanced
                </button>
                <AnimatePresence>
                  {advancedFiltersOpen && (
                    <motion.div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 10 }}
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                      <div className="form-row">
                        <label>Min Orders</label>
                        <input type="number" min="0" value={filters.minOrders} onChange={e => filters.setMinOrders(Number(e.target.value) || 0)} placeholder="0" />
                      </div>
                      <div className="form-row">
                        <label>Merchant Filter</label>
                        <input type="text" value={filters.merchantFilter} onChange={e => filters.setMerchantFilter(e.target.value)} placeholder="Filter by merchant name" />
                      </div>

                      {/* Filter Presets */}
                      <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                        <label>📌 Filter Presets</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          {DEFAULT_PRESETS.map((preset, i) => (
                            <motion.button key={`filter-${preset.name}-${i}`}
                              onClick={() => presetManager.loadPreset(preset)}
                              style={{ padding: '6px 12px', minWidth: 'auto', fontSize: 12 }}
                              variants={buttonVariants} whileHover="hover" whileTap="tap">
                              {preset.name}
                            </motion.button>
                          ))}
                          {presetManager.userPresets.map((preset, i) => (
                            <motion.div key={`user-preset-${preset.name}-${i}`} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <motion.button onClick={() => presetManager.loadPreset(preset)}
                                style={{ padding: '6px 12px', minWidth: 'auto', fontSize: 12 }}
                                variants={buttonVariants} whileHover="hover" whileTap="tap">
                                {preset.name}
                              </motion.button>
                              <motion.button onClick={() => presetManager.deletePreset(i)}
                                style={{ padding: '6px 8px', minWidth: 'auto', fontSize: 12, background: '#ff3b30' }}
                                variants={buttonVariants} whileHover="hover" whileTap="tap" aria-label={`Delete ${preset.name}`}>
                                ✕
                              </motion.button>
                            </motion.div>
                          ))}
                          <motion.button onClick={() => presetManager.setShowPresets(v => !v)}
                            style={{ padding: '6px 12px', minWidth: 'auto', fontSize: 12, background: '#30d158' }}
                            variants={buttonVariants} whileHover="hover" whileTap="tap">
                            + Save Preset
                          </motion.button>
                        </div>

                        {/* Save Preset Form */}
                        <AnimatePresence>
                          {presetManager.showPresets && (
                            <motion.div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}
                              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                              <input type="text" value={presetManager.presetName}
                                onChange={e => presetManager.setPresetName(e.target.value)}
                                placeholder="Preset name..." style={{ flex: 1 }}
                                onKeyDown={e => e.key === 'Enter' && presetManager.savePreset(presetManager.presetName, { query: filters.query, activeOnly: filters.activeOnly, sortBy: filters.sortBy, viewMode: filters.viewMode, levelFilter: filters.levelFilter, minOrders: filters.minOrders, merchantFilter: filters.merchantFilter })} />
                              <motion.button onClick={() => presetManager.savePreset(presetManager.presetName, { query: filters.query, activeOnly: filters.activeOnly, sortBy: filters.sortBy, viewMode: filters.viewMode, levelFilter: filters.levelFilter, minOrders: filters.minOrders, merchantFilter: filters.merchantFilter })}
                                style={{ padding: '8px 16px', minWidth: 'auto' }}
                                variants={buttonVariants} whileHover="hover" whileTap="tap">
                                💾 Save
                              </motion.button>
                              <motion.button onClick={() => presetManager.setShowPresets(false)}
                                style={{ padding: '8px 16px', minWidth: 'auto', background: 'transparent', boxShadow: 'none' }}
                                variants={buttonVariants} whileHover="hover" whileTap="tap">
                                Cancel
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Compact Status Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12, color: '#6e6e73' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label className="chk" style={{ fontSize: 12 }}>
                    <input type="checkbox" checked={dashboard.cfg.soundEnabled} onChange={e => dashboard.setCfg({ ...dashboard.cfg, soundEnabled: e.target.checked })} />
                    🔔
                  </label>
                  <label className="chk" style={{ fontSize: 12 }}>
                    <input type="checkbox" checked={dashboard.cfg.toastEnabled} onChange={e => dashboard.setCfg({ ...dashboard.cfg, toastEnabled: e.target.checked })} />
                    💬
                  </label>
                  <label className="chk" style={{ fontSize: 12 }}>
                    <input type="checkbox" checked={showLevelLabels} onChange={e => setShowLevelLabels(e.target.checked)} />
                    🏷
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!!dashboard.lastOkAt && <span className="ok" role="status" style={{ fontSize: 11 }}>OK {new Date(dashboard.lastOkAt).toLocaleTimeString()}</span>}
                  {dashboard.stale && <span className="stale" role="alert">STALE</span>}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Loading state */}
        {dashboard.loading && !dashboard.data && (
          <motion.div role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SkeletonToolbar />
            <motion.div className="summary card" style={{ marginBottom: 12 }}>
              <SkeletonKPI count={5} />
            </motion.div>
            <motion.div className="card" style={{ marginBottom: 12 }}>
              <Skeleton width="60%" height="20px" style={{ marginBottom: '8px' }} />
              <Skeleton width="80%" height="20px" />
            </motion.div>
            {filters.viewMode === 'table' ? (
              <motion.div className="card fade-in" style={{ marginBottom: 16 }}>
                <SkeletonTableRow count={6} columns={4} />
              </motion.div>
            ) : (
              <motion.div className="grid">
                <SkeletonCardGrid count={4} />
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Error state — only show if no data available */}
        {dashboard.error && !dashboard.data && (
          <ErrorState error={dashboard.error} onRetry={dashboard.fetchData} lastSuccessfulFetch={dashboard.lastOkAt} variant="card" className="fade-in" />
        )}

        {/* Table view */}
        {dashboard.data && filters.viewMode === 'table' && (
          <EnhancedTable
            rows={flatRows} data={flatRows} tableState={tableState}
            levelFilter={filters.levelFilter} query={filters.query} sortBy={filters.sortBy}
            rateWindowMinutes={safeRateWindow} changedKeys={dashboard.changedKeys}
            onClearFilters={() => { filters.clearAllFilters(); addToast('🧹 All filters cleared', 'success', 2000); }}
            hasData={!!dashboard.data}
            LevelIcon={LevelIcon} levelClass={levelClass} levelLabel={levelLabel}
          />
        )}

        {/* Cards view */}
        {dashboard.data && filters.viewMode === 'cards' && (
          <CardView merchantEntries={merchantEntries} changedKeys={dashboard.changedKeys}
            showLevelLabels={showLevelLabels} rateWindow={safeRateWindow} videoIconsEnabled={dashboard.cfg.videoIconsEnabled} />
        )}

        {/* Stopped merchants */}
        <StoppedMerchants stoppedMerchants={dashboard.stoppedMerchants} showStopped={showStopped} setShowStopped={setShowStopped} addToast={addToast} />
      </motion.div>
    </>
  );
}

export default AppInner;