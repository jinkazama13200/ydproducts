import { useState, useEffect, useCallback } from 'react';
import { safeGetItem, safeSetItem } from '../utils/storage';

const STORAGE_KEY = 'filters';

/**
 * Manages all filter state with localStorage persistence
 */
export function useFilters() {
  const [query, setQuery] = useState(() => {
    const saved = safeGetItem(STORAGE_KEY);
    return saved?.query || '';
  });
  const [activeOnly, setActiveOnly] = useState(() => {
    const saved = safeGetItem(STORAGE_KEY);
    return saved?.activeOnly || false;
  });
  const [sortBy, setSortBy] = useState(() => {
    const saved = safeGetItem(STORAGE_KEY);
    return saved?.sortBy || 'orders';
  });
  const [viewMode, setViewMode] = useState(() => {
    const saved = safeGetItem(STORAGE_KEY);
    if (saved) {
      if (typeof window !== 'undefined' && window.innerWidth < 640) {
        return saved.viewMode || 'cards';
      }
      return saved.viewMode || 'table';
    }
    return typeof window !== 'undefined' && window.innerWidth < 640 ? 'cards' : 'table';
  });
  const [levelFilter, setLevelFilter] = useState(() => {
    const saved = safeGetItem(STORAGE_KEY);
    return saved?.levelFilter || 'all';
  });
  const [minOrders, setMinOrders] = useState(() => {
    const saved = safeGetItem(STORAGE_KEY);
    return saved?.minOrders || 0;
  });
  const [merchantFilter, setMerchantFilter] = useState(() => {
    const saved = safeGetItem(STORAGE_KEY);
    return saved?.merchantFilter || '';
  });

  // Persist filters
  useEffect(() => {
    safeSetItem(STORAGE_KEY, { query, activeOnly, sortBy, viewMode, levelFilter, minOrders, merchantFilter });
  }, [query, activeOnly, sortBy, viewMode, levelFilter, minOrders, merchantFilter]);

  const clearAllFilters = useCallback(() => {
    setQuery('');
    setActiveOnly(false);
    setSortBy('orders');
    setViewMode('table');
    setLevelFilter('all');
    setMinOrders(0);
    setMerchantFilter('');
  }, []);

  return {
    query, setQuery,
    activeOnly, setActiveOnly,
    sortBy, setSortBy,
    viewMode, setViewMode,
    levelFilter, setLevelFilter,
    minOrders, setMinOrders,
    merchantFilter, setMerchantFilter,
    clearAllFilters,
  };
}

export default useFilters;