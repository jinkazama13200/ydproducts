import { useState, useCallback } from 'react';
import { safeGetItem, safeSetItem } from '../utils/storage';

const STORAGE_KEY = 'filterPresets';

export const DEFAULT_PRESETS = [
  { name: '🔥 Hot Products', filters: { levelFilter: 'hot', minOrders: 10, sortBy: 'orders' } },
  { name: '🟢 Warm Products', filters: { levelFilter: 'warm', minOrders: 3, sortBy: 'orders' } },
  { name: '📊 All Active', filters: { activeOnly: true, levelFilter: 'all', sortBy: 'orders' } },
  { name: '🏆 Top Merchants', filters: { sortBy: 'products', viewMode: 'cards' } },
];

export function useFilterPresets({ onLoadPreset, addToast }) {
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [userPresets, setUserPresets] = useState(() => {
    return safeGetItem(STORAGE_KEY) || [];
  });

  const savePreset = useCallback((name, filters) => {
    if (!name.trim()) {
      addToast?.('⚠️ Please enter a preset name', 'warning', 2000);
      return;
    }
    const newPreset = { name: name.trim(), filters };
    setUserPresets(prev => {
      const updated = [...prev, newPreset];
      safeSetItem(STORAGE_KEY, updated);
      return updated;
    });
    setPresetName('');
    addToast?.(`💾 Preset saved: ${name.trim()}`, 'success', 2000);
  }, [addToast]);

  const deletePreset = useCallback((index) => {
    setUserPresets(prev => {
      const updated = prev.filter((_, i) => i !== index);
      safeSetItem(STORAGE_KEY, updated);
      return updated;
    });
    addToast?.('🗑️ Preset deleted', 'success', 2000);
  }, [addToast]);

  const loadPreset = useCallback((preset) => {
    onLoadPreset?.(preset);
  }, [onLoadPreset]);

  return {
    showPresets,
    setShowPresets,
    presetName,
    setPresetName,
    userPresets,
    savePreset,
    deletePreset,
    loadPreset,
  };
}

export default useFilterPresets;