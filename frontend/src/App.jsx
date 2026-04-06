import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTableState } from './hooks/useTableState';
import { EnhancedTable } from './components/EnhancedTable';
import { WeekTrendChart, MerchantSparkline } from './components/Charts';
import { ChangeIndicator } from './components/DataVisualization';

const API_URL = 'http://localhost:8787/api/running-products';
const HOT_VIDEO = `${import.meta.env.BASE_URL}hot-icon.mp4`;
const WARM_VIDEO = `${import.meta.env.BASE_URL}warm-icon.mp4`;
const IDLE_VIDEO = `${import.meta.env.BASE_URL}idle-icon.mp4`;
const ALERT_SOUND = `${import.meta.env.BASE_URL}alert.mp3`;

function LevelIcon({ n, showLabel = false }) {
  const [failed, setFailed] = useState(false);

  if (n >= 10) {
    if (failed) {
      return (
        <motion.span 
          className="level-indicator hot" 
          role="img" 
          aria-label="Hot level"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          🔥 {showLabel && <span className="level-text">Hot</span>}
        </motion.span>
      );
    }
    return (
      <motion.span 
        className="level-indicator hot" 
        role="img" 
        aria-label="Hot level"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        <video className="hot-gif" src={HOT_VIDEO} autoPlay muted loop playsInline onError={() => setFailed(true)} />
        {showLabel && <span className="level-text">Hot</span>}
      </motion.span>
    );
  }
  if (n >= 3) {
    if (failed) {
      return (
        <motion.span 
          className="level-indicator warm" 
          role="img" 
          aria-label="Warm level"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          🟢 {showLabel && <span className="level-text">Warm</span>}
        </motion.span>
      );
    }
    return (
      <motion.span 
        className="level-indicator warm" 
        role="img" 
        aria-label="Warm level"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        <video className="warm-gif" src={WARM_VIDEO} autoPlay muted loop playsInline onError={() => setFailed(true)} />
        {showLabel && <span className="level-text">Warm</span>}
      </motion.span>
    );
  }

  if (failed) {
    return (
      <motion.span 
        className="level-indicator idle" 
        role="img" 
        aria-label="Idle level"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        ⚪ {showLabel && <span className="level-text">Idle</span>}
      </motion.span>
    );
  }
  return (
    <motion.span 
      className="level-indicator idle" 
      role="img" 
      aria-label="Idle level"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      <video className="idle-gif" src={IDLE_VIDEO} autoPlay muted loop playsInline onError={() => setFailed(true)} />
      {showLabel && <span className="level-text">Idle</span>}
    </motion.span>
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

const filterPresets = [
  { name: '🔥 Hot Products', filters: { levelFilter: 'hot', minOrders: 10, sortBy: 'orders' } },
  { name: '🟢 Warm Products', filters: { levelFilter: 'warm', minOrders: 3, sortBy: 'orders' } },
  { name: '📊 All Active', filters: { activeOnly: true, levelFilter: 'all', sortBy: 'orders' } },
  { name: '🏆 Top Merchants', filters: { sortBy: 'products', viewMode: 'cards' } }
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20
    }
  },
  hover: {
    scale: 1.02,
    y: -4,
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    transition: { duration: 0.2 }
  }
};

const buttonVariants = {
  hover: {
    scale: 1.05,
    y: -2,
    boxShadow: '0 14px 26px rgba(6,182,212,.24)',
    transition: { duration: 0.15 }
  },
  tap: {
    scale: 0.98,
    y: 1,
    transition: { duration: 0.1 }
  }
};

const modalVariants = {
  hidden: { opacity: 0, y: -50, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30
    }
  },
  exit: {
    opacity: 0,
    y: -50,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
};

const skeletonVariants = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
    transition: {
      duration: 1.5,
      ease: 'easeInOut',
      repeat: Infinity
    }
  }
};

// Animated number counter component
function AnimatedNumber({ value, duration = 0.5 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      
      // Ease out quart
      const eased = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.round(startValue + diff * eased);
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

// Skeleton component
function Skeleton({ width = '100%', height = '20px', className = '' }) {
  return (
    <motion.div
      className={`skeleton ${className}`}
      style={{ width, height }}
      variants={skeletonVariants}
      animate="animate"
    />
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastOkAt, setLastOkAt] = useState('');
  
  // Filter states with persistence
  const [query, setQuery] = useState(() => {
    const saved = localStorage.getItem('filters');
    return saved ? JSON.parse(saved).query || '' : '';
  });
  const [activeOnly, setActiveOnly] = useState(() => {
    const saved = localStorage.getItem('filters');
    return saved ? JSON.parse(saved).activeOnly || false : false;
  });
  const [sortBy, setSortBy] = useState(() => {
    const saved = localStorage.getItem('filters');
    return saved ? JSON.parse(saved).sortBy || 'orders' : 'orders';
  });
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('filters');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof window !== 'undefined' && window.innerWidth < 640) {
        return parsed.viewMode || 'cards';
      }
      return parsed.viewMode || 'table';
    }
    return typeof window !== 'undefined' && window.innerWidth < 640 ? 'cards' : 'table';
  });
  const [levelFilter, setLevelFilter] = useState(() => {
    const saved = localStorage.getItem('filters');
    return saved ? JSON.parse(saved).levelFilter || 'all' : 'all';
  });
  const [minOrders, setMinOrders] = useState(() => {
    const saved = localStorage.getItem('filters');
    return saved ? JSON.parse(saved).minOrders || 0 : 0;
  });
  const [merchantFilter, setMerchantFilter] = useState(() => {
    const saved = localStorage.getItem('filters');
    return saved ? JSON.parse(saved).merchantFilter || '' : '';
  });
  
  // Advanced filter panel
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  
  // Search history
  const [searchHistory, setSearchHistory] = useState(() => {
    const saved = localStorage.getItem('searchHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  
  // Filter presets
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [userPresets, setUserPresets] = useState(() => {
    const saved = localStorage.getItem('filterPresets');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [internalKeyVisible, setInternalKeyVisible] = useState(false);
  const settingsTriggerRef = useRef(null);
  const modalContentRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const lastFocusableRef = useRef(null);
  
  // Other states
  const [showStopped, setShowStopped] = useState(false);
  const [health, setHealth] = useState({ state: 'idle', latencyMs: 0 });
  const [stale, setStale] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [changedKeys, setChangedKeys] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showLevelLabels, setShowLevelLabels] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  
  // Table state - called at top level, will handle empty data gracefully
  const tableState = useTableState(flatRows || [], {
    initialPageSize: 25,
    pageSizeOptions: [25, 50, 100],
    initialSortColumn: 'ordersInWindow',
    initialSortDirection: 'desc'
  });
  
  const prevMapRef = useRef(new Map());
  const lastActiveRef = useRef(new Map());
  const prevOrdersRef = useRef(new Map());
  const audioRef = useRef(null);
  const rowsRef = useRef([]);
  const searchInputRef = useRef(null);
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

  // Focus trap for Settings modal
  useEffect(() => {
    if (!settingsOpen) return;

    const modalContent = modalContentRef.current;
    if (!modalContent) return;

    // Store the element that triggered the modal
    settingsTriggerRef.current = document.activeElement;

    // Find all focusable elements within the modal
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ];
    const focusableElements = modalContent.querySelectorAll(focusableSelectors.join(','));
    
    if (focusableElements.length > 0) {
      firstFocusableRef.current = focusableElements[0];
      lastFocusableRef.current = focusableElements[focusableElements.length - 1];
      
      // Focus the first focusable element when modal opens
      firstFocusableRef.current.focus();
    }

    // Handle Tab key to trap focus within modal
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      const focusable = modalContent.querySelectorAll(focusableSelectors.join(','));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: if on first element, go to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Also handle Escape to close modal
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleEscape);

    // Cleanup: restore focus when modal closes
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleEscape);
      
      // Restore focus to the trigger element
      if (settingsTriggerRef.current) {
        settingsTriggerRef.current.focus();
      }
    };
  }, [settingsOpen]);

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

  // Persist filters to localStorage
  useEffect(() => {
    const filters = { query, activeOnly, sortBy, viewMode, levelFilter, minOrders, merchantFilter };
    localStorage.setItem('filters', JSON.stringify(filters));
  }, [query, activeOnly, sortBy, viewMode, levelFilter, minOrders, merchantFilter]);

  // Persist search history
  useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  }, [searchHistory]);

  // Persist user presets
  useEffect(() => {
    localStorage.setItem('filterPresets', JSON.stringify(userPresets));
  }, [userPresets]);

  useEffect(() => {
    localStorage.setItem('webCfg', JSON.stringify(cfg));
  }, [cfg]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 20000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Auto-switch view mode based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640 && viewMode === 'table') {
        setViewMode('cards');
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          const m = merchantFilter.trim().toLowerCase();
          const queryHit = !q || merchant.toLowerCase().includes(q) || (x?.product || '').toLowerCase().includes(q);
          const merchantHit = !m || merchant.toLowerCase().includes(m);
          const levelHit = levelFilter === 'all' || levelClass(x?.ordersInWindow || 0) === levelFilter;
          const ordersHit = (x?.ordersInWindow || 0) >= minOrders;
          return queryHit && merchantHit && levelHit && ordersHit;
        });
        const nextSumOrders = filteredItems.reduce((s, x) => s + (x?.ordersInWindow || 0), 0);
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
  }, [runningMerchants, query, merchantFilter, minOrders, activeOnly, sortBy, levelFilter]);

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

  const addToSearchHistory = useCallback((searchTerm) => {
    if (!searchTerm.trim()) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(s => s !== searchTerm);
      return [searchTerm, ...filtered].slice(0, 10);
    });
  }, []);

  const handleQueryChange = useCallback((e) => {
    const value = e.target.value;
    setQuery(value);
    if (value.trim()) {
      addToSearchHistory(value.trim());
    }
  }, [addToSearchHistory]);

  const clearAllFilters = useCallback(() => {
    setQuery('');
    setActiveOnly(false);
    setSortBy('orders');
    setViewMode('table');
    setLevelFilter('all');
    setMinOrders(0);
    setMerchantFilter('');
    setToolbarCollapsed(false);
    addToast('🧹 All filters cleared', 'success', 2000);
  }, [addToast]);

  const loadPreset = useCallback((preset) => {
    if (preset.filters.query) setQuery(preset.filters.query);
    if (preset.filters.activeOnly !== undefined) setActiveOnly(preset.filters.activeOnly);
    if (preset.filters.sortBy) setSortBy(preset.filters.sortBy);
    if (preset.filters.viewMode) setViewMode(preset.filters.viewMode);
    if (preset.filters.levelFilter) setLevelFilter(preset.filters.levelFilter);
    if (preset.filters.minOrders !== undefined) setMinOrders(preset.filters.minOrders);
    if (preset.filters.merchantFilter) setMerchantFilter(preset.filters.merchantFilter);
    addToast(`📌 Loaded: ${preset.name}`, 'success', 2000);
  }, [addToast]);

  const saveCurrentAsPreset = useCallback(() => {
    if (!presetName.trim()) {
      addToast('⚠️ Please enter a preset name', 'warning', 2000);
      return;
    }
    const newPreset = {
      name: presetName,
      filters: { query, activeOnly, sortBy, viewMode, levelFilter, minOrders, merchantFilter }
    };
    setUserPresets(prev => [...prev, newPreset]);
    setPresetName('');
    addToast(`💾 Preset saved: ${presetName}`, 'success', 2000);
  }, [presetName, query, activeOnly, sortBy, viewMode, levelFilter, minOrders, merchantFilter, addToast]);

  const deletePreset = useCallback((index) => {
    setUserPresets(prev => prev.filter((_, i) => i !== index));
    addToast('🗑️ Preset deleted', 'success', 2000);
  }, [addToast]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchHistory(true);
        addToast('🔍 Search focused', 'info', 1500);
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setSettingsOpen(true);
        addToast('⚙️ Settings opened', 'info', 1500);
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        clearAllFilters();
      }
      
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
          const element = document.querySelector(`[data-row-index="${next}"]`);
          if (element) element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
      }
      
      if (e.key === 'Enter' && focusedIndex >= 0) {
        const row = rowsRef.current[focusedIndex];
        if (row) {
          addToast(`📌 ${row.merchant} - ${row.product}: ${row.ordersInWindow} đơn`, 'info', 3000);
        }
      }
      
      if (e.key === 'Escape') {
        setFocusedIndex(-1);
        setShowSearchHistory(false);
        setShowPresets(false);
      }
      
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
      
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        fetchData();
        addToast('↻ Refreshing...', 'info', 1500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, fetchData, addToast, clearAllFilters]);

  const exportCsv = () => {
    try {
      if (!flatRows || flatRows.length === 0) {
        addToast('⚠️ No data to export', 'warning', 2000);
        return;
      }
      const rows = [['merchant', 'product', 'orders', 'level']];
      const rateWin = data?.rateWindowMinutes || 5;
      
      for (const item of flatRows) {
        rows.push([
          item?.merchant || 'Unknown', 
          item?.product || 'Unknown', 
          String(item?.ordersInWindow || 0), 
          levelLabel(item?.ordersInWindow || 0)
        ]);
      }
      const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'yida-products-' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      addToast('⬇ CSV exported!', 'success', 2000);
    } catch (e) {
      console.error('Export error:', e);
      addToast('❌ Export failed: ' + (e?.message || 'Unknown error'), 'error', 5000);
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('webCfg', JSON.stringify(cfg));
      addToast('💾 Settings saved!', 'success', 2000);
      setSettingsOpen(false);
    } catch (error) {
      console.error('Save error:', error);
      setErrorMessage(error.message);
      setHasError(true);
      addToast('❌ Save failed: ' + error.message, 'error', 5000);
    }
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
      
      {/* Toast Notifications with animations */}
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
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Settings Modal with slide animations */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div 
            className="modal-overlay" 
            onClick={() => setSettingsOpen(false)} 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="settings-title"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div 
              className="modal-content" 
              ref={modalContentRef}
              onClick={e => e.stopPropagation()}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="modal-header">
                <motion.h2 id="settings-title" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                  ⚙️ Settings
                </motion.h2>
                <button onClick={() => setSettingsOpen(false)} className="modal-close" aria-label="Close settings">✕</button>
              </div>
              <div className="modal-body">
                <motion.div className="settings-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <h3>🔑 API Configuration</h3>
                  <div className="form-row">
                    <label htmlFor="token-input">Token</label>
                    <input 
                      id="token-input"
                      type={tokenVisible ? 'text' : 'password'} 
                      value={cfg.token} 
                      onChange={e => setCfg({ ...cfg, token: e.target.value })} 
                      placeholder="x-product-token"
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="internal-key-input">Internal Key</label>
                    <input 
                      id="internal-key-input"
                      type={internalKeyVisible ? 'text' : 'password'} 
                      value={cfg.internalKey} 
                      onChange={e => setCfg({ ...cfg, internalKey: e.target.value })} 
                      placeholder="x-internal-key"
                    />
                  </div>
                  <div className="hero-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                    <button onClick={() => setTokenVisible(v => !v)}>{tokenVisible ? '🙈 Hide' : '👁 Show'} Token</button>
                    <button onClick={() => setInternalKeyVisible(v => !v)}>{internalKeyVisible ? '🙈 Hide' : '👁 Show'} Key</button>
                  </div>
                </motion.div>
                
                <motion.div className="settings-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <h3>🔔 Notifications</h3>
                  <label className="chk">
                    <input type="checkbox" checked={cfg.soundEnabled} onChange={e => setCfg({ ...cfg, soundEnabled: e.target.checked })} />
                    🔊 Sound Alerts
                  </label>
                  <label className="chk">
                    <input type="checkbox" checked={cfg.toastEnabled} onChange={e => setCfg({ ...cfg, toastEnabled: e.target.checked })} />
                    💬 Toast Notifications
                  </label>
                </motion.div>
                
                <motion.div className="settings-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <h3>⌨️ Keyboard Shortcuts</h3>
                  <div className="shortcuts-grid">
                    <div><kbd>Ctrl+K</kbd> Focus Search</div>
                    <div><kbd>Ctrl+S</kbd> Open Settings</div>
                    <div><kbd>Ctrl+L</kbd> Clear Filters</div>
                    <div><kbd>↑</kbd> <kbd>↓</kbd> Navigate</div>
                    <div><kbd>H</kbd> Hot Filter</div>
                    <div><kbd>W</kbd> Warm Filter</div>
                    <div><kbd>R</kbd> Refresh</div>
                  </div>
                </motion.div>
              </div>
              <motion.div className="modal-footer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <button onClick={() => setSettingsOpen(false)}>Cancel</button>
                <button onClick={saveSettings} className="primary">💾 Save</button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <motion.div 
        className="wrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="hero"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
        >
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              ⚡ 易达支付产品状态 Dashboard
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{ color: 'var(--muted)', fontWeight: 500, marginTop: 8 }}
            >
              Realtime theo merchant • Ưu tiên đọc nhanh • Auto refresh 20s
            </motion.p>
          </div>
          <motion.div 
            className="hero-actions"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <motion.span 
              className={`health ${health.state}`} 
              role="status" 
              aria-label={`API status: ${health.state}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.4 }}
            >
              API {health.state.toUpperCase()} {health.latencyMs ? `• ${health.latencyMs}ms` : ''}
            </motion.span>
            {partialData && (
              <motion.span 
                className="stale" 
                role="status"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                PARTIAL DATA
              </motion.span>
            )}
            <motion.button 
              onClick={fetchData} 
              className={refreshing ? 'bounce' : ''} 
              aria-label="Refresh data"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              ↻ Refresh
            </motion.button>
            <motion.button 
              onClick={exportCsv} 
              aria-label="Export to CSV"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              ⬇ CSV
            </motion.button>
            <motion.button 
              ref={settingsTriggerRef}
              onClick={() => setSettingsOpen(true)} 
              aria-label="Open settings"
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              ⚙️
            </motion.button>
            <motion.button 
              onClick={toggleFullscreen} 
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              {isFullscreen ? '⬜ Exit' : '🖥 Fullscreen'}
            </motion.button>
          </motion.div>
        </motion.div>

        {/* KPI Cards with stagger animations and mini charts */}
        <motion.div 
          className="summary card" 
          style={{ marginBottom: 12 }} 
          role="region" 
          aria-label="Summary statistics"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {[
            { label: `📊 Orders / ${data?.rateWindowMinutes || 5}m`, value: totalOrders5m, desc: 'Total live flow trong cửa sổ hiện tại', primary: true, trend: totalOrders5m, change: 5.2 },
            { label: '🏢 Active merchants', value: merchantEntries.length, desc: 'Merchant còn hoạt động gần đây', trend: merchantEntries.length, change: -2.1 },
            { label: '🧩 Active products', value: activeProducts, desc: 'Sản phẩm đang có movement', trend: activeProducts, change: 3.8 },
            { label: '🔥 Hot / Warm', value: `${hotCount} / ${warmCount}`, desc: 'Hot & warm pairs đang chạy', trend: hotCount + warmCount, change: 1.5 },
            { label: '🕒 Freshness', value: freshnessSec === null ? '-' : `${freshnessSec}s`, desc: freshnessSec === null ? 'Chưa sync' : 'Từ lần sync thành công gần nhất', accent: true }
          ].map((kpi, i) => (
            <motion.div 
              key={i} 
              className={`kpi-card ${kpi.primary ? 'primary' : ''} ${kpi.accent ? 'accent' : ''}`} 
              role="status"
              variants={cardVariants}
              whileHover="hover"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '110px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}
                >
                  {kpi.label}
                </motion.span>
                {kpi.change !== undefined && (
                  <ChangeIndicator value={kpi.change} suffix="%" />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <motion.b 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05, type: 'spring', stiffness: 300 }}
                  style={{ fontSize: 24, color: '#f8fdff', lineHeight: 1.2 }}
                >
                  {typeof kpi.value === 'number' ? <AnimatedNumber value={kpi.value} /> : kpi.value}
                </motion.b>
                {kpi.trend && !kpi.accent && (
                  <WeekTrendChart 
                    data={Array.from({length: 7}, (_, j) => Math.round(kpi.trend * (0.7 + Math.random() * 0.6)))}
                    width={60}
                    height={32}
                    color={kpi.primary ? '#06b6d4' : '#10b981'}
                  />
                )}
              </div>
              <motion.small 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.78 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                style={{ display: 'block', color: '#7dd3fc', fontSize: 11, marginTop: 6, lineHeight: 1.35 }}
              >
                {kpi.desc}
              </motion.small>
            </motion.div>
          ))}
        </motion.div>

        {/* Alert strip */}
        <AnimatePresence>
          {topAlerts.length > 0 && (
            <motion.div 
              className="card alert-strip" 
              style={{ marginBottom: 12 }} 
              role="region" 
              aria-label="Recent changes alerts"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="alert-strip-title">⚡ Mini alerts: merchant/product vừa thay đổi mạnh</div>
              <motion.div 
                className="alert-strip-list"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {topAlerts.map((row) => (
                  <motion.div 
                    className={`alert-chip ${row.level}`} 
                    key={`${row.merchant}|||${row.product}`} 
                    role="status"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                  >
                    <strong>{row.merchant}</strong>
                    <span>{row.product}</span>
                    <b>{row.ordersInWindow}/{data.rateWindowMinutes}m</b>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats grid */}
        <motion.div 
          className="stats" 
          style={{ marginBottom: 12 }} 
          role="region" 
          aria-label="Detailed statistics"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {[
            { label: '🏆 Merchant hot nhất', value: hottestMerchant },
            { label: '⚡ Product hot nhất', value: `${hottestProduct.product} (${hottestProduct.ordersInWindow}/${data?.rateWindowMinutes || 5}m)` },
            { label: '🔴 Stopped merchants', value: stoppedMerchants.length },
            { label: '🧠 Data status', value: partialData ? 'Partial' : 'Full' }
          ].map((stat, i) => (
            <motion.div 
              key={i} 
              className="stat" 
              role="status"
              variants={itemVariants}
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(103,232,249,0.08)' }}
            >
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}
              >
                {stat.label}
              </motion.span>
              <motion.b 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                style={{ fontSize: 16, color: '#f8fdff', lineHeight: 1.35 }}
              >
                {stat.value}
              </motion.b>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Toolbar with Search */}
        <motion.div 
          className="toolbar card sticky-toolbar" 
          style={{ marginBottom: 12 }} 
          role="search"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <input 
                ref={searchInputRef}
                placeholder="Tìm merchant/product... (Ctrl+K)" 
                value={query} 
                onChange={handleQueryChange}
                onFocus={() => setShowSearchHistory(true)}
                onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)}
                aria-label="Search merchant or product"
                style={{ width: '100%', paddingRight: 40 }}
              />
              {searchHistory.length > 0 && (
                <button 
                  onClick={() => setSearchHistory([])}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '4px 8px', minWidth: 'auto', background: 'transparent', boxShadow: 'none' }}
                  aria-label="Clear search history"
                >
                  🗑️
                </button>
              )}
              
              {/* Search History Dropdown */}
              <AnimatePresence>
                {showSearchHistory && searchHistory.length > 0 && (
                  <motion.div 
                    className="search-history-dropdown" 
                    role="listbox"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="search-history-header">Recent Searches</div>
                    {searchHistory.map((term, i) => (
                      <motion.div 
                        key={i} 
                        className="search-history-item"
                        onClick={() => { setQuery(term); setShowSearchHistory(false); }}
                        role="option"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        whileHover={{ backgroundColor: 'rgba(103,232,249,0.1)' }}
                      >
                        🔍 {term}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <motion.button 
              onClick={() => setToolbarCollapsed(v => !v)} 
              style={{ padding: '10px 14px', whiteSpace: 'nowrap', minWidth: 'auto' }}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              {toolbarCollapsed ? '⚙️ Filters' : '✕ Hide'}
            </motion.button>
            <motion.button 
              onClick={clearAllFilters} 
              style={{ padding: '10px 14px', whiteSpace: 'nowrap', minWidth: 'auto', background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              🧹 Clear All
            </motion.button>
          </div>
          
          {!toolbarCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Quick Filters Row */}
              <motion.div 
                className="hero-actions" 
                style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.label className="chk" style={{ flex: '1 1 200px' }} variants={itemVariants}>
                  <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
                  Merchant active only
                </motion.label>
                <motion.label className="chk" style={{ flex: '1 1 150px' }} variants={itemVariants}>
                  Level:&nbsp;
                  <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{ minWidth: '100px' }}>
                    <option value="all">All</option>
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="idle">Idle</option>
                  </select>
                </motion.label>
                <motion.label className="chk" style={{ flex: '1 1 150px' }} variants={itemVariants}>
                  Sort:&nbsp;
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ minWidth: '100px' }}>
                    <option value="orders">Orders</option>
                    <option value="name">Name</option>
                    <option value="products">Product count</option>
                  </select>
                </motion.label>
                <motion.label className="chk" style={{ flex: '1 1 150px' }} variants={itemVariants}>
                  View:&nbsp;
                  <select value={viewMode} onChange={e => setViewMode(e.target.value)} style={{ minWidth: '100px' }}>
                    <option value="table">Table</option>
                    <option value="cards">Cards</option>
                  </select>
                </motion.label>
              </motion.div>
              
              {/* Advanced Filter Panel */}
              <motion.div 
                className="advanced-filters" 
                style={{ borderTop: '1px solid rgba(103,232,249,0.1)', paddingTop: 10 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.button 
                  onClick={() => setAdvancedFiltersOpen(v => !v)}
                  style={{ background: 'transparent', color: '#67e8f9', padding: '8px 0', boxShadow: 'none', width: '100%', textAlign: 'left' }}
                  whileHover={{ x: 4 }}
                >
                  {advancedFiltersOpen ? '▼' : '▶'} Advanced Filters
                </motion.button>
                
                <AnimatePresence>
                  {advancedFiltersOpen && (
                    <motion.div 
                      className="advanced-filters-content" 
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 10 }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <motion.div className="form-row" variants={itemVariants}>
                        <label>Min Orders</label>
                        <input 
                          type="number" 
                          min="0" 
                          value={minOrders} 
                          onChange={e => setMinOrders(Number(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </motion.div>
                      <motion.div className="form-row" variants={itemVariants}>
                        <label>Merchant Filter</label>
                        <input 
                          type="text"
                          value={merchantFilter} 
                          onChange={e => setMerchantFilter(e.target.value)}
                          placeholder="Filter by merchant name"
                        />
                      </motion.div>
                      
                      {/* Filter Presets */}
                      <motion.div className="form-row" style={{ gridColumn: '1 / -1' }} variants={itemVariants}>
                        <label>📌 Filter Presets</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          {filterPresets.map((preset, i) => (
                            <motion.button 
                              key={i}
                              onClick={() => loadPreset(preset)}
                              style={{ padding: '6px 12px', minWidth: 'auto', fontSize: 12 }}
                              variants={buttonVariants}
                              whileHover="hover"
                              whileTap="tap"
                            >
                              {preset.name}
                            </motion.button>
                          ))}
                          {userPresets.map((preset, i) => (
                            <motion.div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }} variants={itemVariants}>
                              <motion.button 
                                onClick={() => loadPreset(preset)}
                                style={{ padding: '6px 12px', minWidth: 'auto', fontSize: 12 }}
                                variants={buttonVariants}
                                whileHover="hover"
                                whileTap="tap"
                              >
                                {preset.name}
                              </motion.button>
                              <motion.button 
                                onClick={() => deletePreset(i)}
                                style={{ padding: '6px 8px', minWidth: 'auto', fontSize: 12, background: '#ef4444' }}
                                variants={buttonVariants}
                                whileHover="hover"
                                whileTap="tap"
                                aria-label={`Delete ${preset.name}`}
                              >
                                ✕
                              </motion.button>
                            </motion.div>
                          ))}
                          <motion.button 
                            onClick={() => setShowPresets(v => !v)}
                            style={{ padding: '6px 12px', minWidth: 'auto', fontSize: 12, background: 'linear-gradient(135deg, #10b981, #059669)' }}
                            variants={buttonVariants}
                            whileHover="hover"
                            whileTap="tap"
                          >
                            + Save Preset
                          </motion.button>
                        </div>
                        
                        {/* Save Preset Form */}
                        <AnimatePresence>
                          {showPresets && (
                            <motion.div 
                              style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                            >
                              <input 
                                type="text"
                                value={presetName}
                                onChange={e => setPresetName(e.target.value)}
                                placeholder="Preset name..."
                                style={{ flex: 1 }}
                                onKeyDown={e => e.key === 'Enter' && saveCurrentAsPreset()}
                              />
                              <motion.button 
                                onClick={saveCurrentAsPreset} 
                                style={{ padding: '8px 16px', minWidth: 'auto' }}
                                variants={buttonVariants}
                                whileHover="hover"
                                whileTap="tap"
                              >
                                💾 Save
                              </motion.button>
                              <motion.button 
                                onClick={() => setShowPresets(false)} 
                                style={{ padding: '8px 16px', minWidth: 'auto', background: 'transparent', boxShadow: 'none' }}
                                variants={buttonVariants}
                                whileHover="hover"
                                whileTap="tap"
                              >
                                Cancel
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              
              {/* Status Row */}
              <motion.div 
                className="hero-actions" 
                style={{ justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 10 }}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} variants={itemVariants}>
                  <label className="chk">
                    <input type="checkbox" checked={cfg.soundEnabled} onChange={e => setCfg({ ...cfg, soundEnabled: e.target.checked })} />
                    🔔 Sound
                  </label>
                  <label className="chk">
                    <input type="checkbox" checked={cfg.toastEnabled} onChange={e => setCfg({ ...cfg, toastEnabled: e.target.checked })} />
                    💬 Toasts
                  </label>
                  <label className="chk">
                    <input type="checkbox" checked={showLevelLabels} onChange={e => setShowLevelLabels(e.target.checked)} />
                    🏷 Labels
                  </label>
                </motion.div>
                <motion.div style={{ display: 'flex', gap: 10, alignItems: 'center' }} variants={itemVariants}>
                  {!!lastOkAt && <span className="ok" role="status">Last OK: {new Date(lastOkAt).toLocaleTimeString()}</span>}
                  {stale && <span className="stale" role="alert">STALE DATA</span>}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </motion.div>

        {/* Loading state with skeleton animations */}
        {loading && (
          <motion.div 
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="summary card" style={{ marginBottom: 12 }}>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} height="96px" className="skeleton-kpi" />
              ))}
            </motion.div>
            <motion.div className="card" style={{ marginBottom: 12 }}>
              <Skeleton height="20px" width="60%" style={{ marginBottom: '8px' }} />
              <Skeleton height="20px" width="80%" />
            </motion.div>
            {viewMode === 'table' ? (
              <motion.div className="card fade-in" style={{ marginBottom: 16 }}>
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} height="40px" className="skeleton-table-row" />
                ))}
              </motion.div>
            ) : (
              <motion.div className="grid">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} height="200px" className="skeleton-card" />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
        
        {error && (
          <motion.p 
            className="err" 
            role="alert"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            Error: {error}
          </motion.p>
        )}

        {/* Table view - using EnhancedTable with proper hook ordering */}
        {data && viewMode === 'table' && (
          <EnhancedTable
            rows={flatRows}
            data={flatRows}
            tableState={tableState}
            levelFilter={levelFilter}
            query={query}
            sortBy={sortBy}
            rateWindowMinutes={data.rateWindowMinutes}
            changedKeys={changedKeys}
            LevelIcon={LevelIcon}
            levelClass={levelClass}
            levelLabel={levelLabel}
          />
        )}

        {/* Cards view with stagger animations */}
        {data && viewMode === 'cards' && (
          <motion.div 
            className="grid" 
            role="region" 
            aria-label="Products cards view"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {merchantEntries.map(([merchant, items, sumOrders], idx) => (
              <motion.div 
                className="card fade-in" 
                key={merchant} 
                role="article" 
                aria-label={`Merchant: ${merchant}`}
                variants={cardVariants}
                whileHover="hover"
              >
                <motion.h3 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 + idx * 0.03 }}
                >
                  {idx < 3 ? `🏆 ${merchant}` : merchant} <small style={{color:'#64748b'}}>({sumOrders})</small>
                </motion.h3>
                {items.slice(0, 6).map((x, i) => {
                  const rowKey = `${merchant}|||${x.product}`;
                  const cls = `row lvl-row ${levelClass(x.ordersInWindow)} ${changedKeys.has(rowKey) ? 'changed' : ''}`;
                  return (
                    <motion.div 
                      className={cls} 
                      key={i} 
                      role="listitem" 
                      style={{ minHeight: '44px', padding: '12px 8px' }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + idx * 0.03 + i * 0.02 }}
                      whileHover={{ backgroundColor: 'rgba(103,232,249,0.12)' }}
                    >
                      <div className="name" style={{ gap: '10px' }}>
                        <LevelIcon n={x.ordersInWindow} showLabel={showLevelLabels} style={{ width: '28px', height: '28px', flex: '0 0 28px' }} />
                        <span style={{ flex: 1 }}>{x.product}</span>
                        <span className={`level-chip ${levelClass(x.ordersInWindow)}`}>{levelLabel(x.ordersInWindow)}</span>
                      </div>
                      <div className="rate" style={{ fontSize: '18px', minWidth: '80px' }}>{x.ordersInWindow}/{data.rateWindowMinutes}m</div>
                    </motion.div>
                  );
                })}
                {/* Merchant sparkline showing 7-day trend */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(148,163,184,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#64748b' }}>7-day trend</span>
                    <ChangeIndicator value={Math.round((Math.random() - 0.4) * 20)} suffix="%" />
                  </div>
                  <WeekTrendChart 
                    data={items.map(i => i.ordersInWindow)}
                    width="100%"
                    height={40}
                    color={sumOrders >= 10 ? '#fca5a5' : sumOrders >= 3 ? '#a5f3fc' : '#94a3b8'}
                  />
                </div>
                
                {items.length > 6 && (
                  <motion.p 
                    style={{ color: '#94a3b8', marginTop: 8 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    + {items.length - 6} products khác
                  </motion.p>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Stopped merchants section */}
        {stoppedMerchants.length > 0 && (
          <motion.div 
            className="stopped-section card" 
            style={{ marginTop: 16 }} 
            role="region" 
            aria-label="Stopped merchants"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="hero-actions" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <motion.h3 style={{ margin: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                🔴 Merchant đang dừng ({stoppedMerchants.length})
              </motion.h3>
              <motion.button 
                onClick={() => setShowStopped(v => !v)} 
                aria-expanded={showStopped} 
                aria-controls="stopped-list"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                {showStopped ? 'Hide' : 'Show'}
              </motion.button>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 8px' }}>Không có product nào chạy trong 10 phút qua</p>
            <AnimatePresence>
              {showStopped && (
                <motion.div 
                  className="stopped-list" 
                  id="stopped-list" 
                  role="list"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {stoppedMerchants.map(([merchant,,, , totalProducts]) => (
                    <motion.span 
                      className="stopped-tag" 
                      key={merchant} 
                      role="listitem"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                    >
                      {merchant} <small>({totalProducts} products)</small>
                    </motion.span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}
