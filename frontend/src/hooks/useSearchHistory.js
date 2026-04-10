import { useState, useCallback } from 'react';
import { safeGetItem, safeSetItem } from '../utils/storage';

const STORAGE_KEY = 'searchHistory';
const MAX_HISTORY = 10;

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState(() => {
    return safeGetItem(STORAGE_KEY) || [];
  });
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  const addToHistory = useCallback((searchTerm) => {
    if (!searchTerm.trim()) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(s => s !== searchTerm);
      const updated = [searchTerm, ...filtered].slice(0, MAX_HISTORY);
      safeSetItem(STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    safeSetItem(STORAGE_KEY, []);
  }, []);

  const removeFromHistory = useCallback((searchTerm) => {
    setSearchHistory(prev => {
      const updated = prev.filter(s => s !== searchTerm);
      safeSetItem(STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  return {
    searchHistory,
    showSearchHistory,
    setShowSearchHistory,
    addToHistory,
    clearHistory,
    removeFromHistory,
  };
}

export default useSearchHistory;