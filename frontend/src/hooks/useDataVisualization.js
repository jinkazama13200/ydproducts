import { useState, useEffect, useMemo } from 'react';

/**
 * Hook for managing historical data and calculating trends
 * Compares current data with historical snapshots
 */
export function useHistoricalComparison(currentData, options = {}) {
  const {
    storageKey = 'merchant-history',
    comparisonPeriods = ['1h', '24h'],
    maxHistoryItems = 100
  } = options;

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save snapshot of current data
  const saveSnapshot = () => {
    const snapshot = {
      timestamp: Date.now(),
      data: currentData
    };

    setHistory(prev => {
      const updated = [snapshot, ...prev].slice(0, maxHistoryItems);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  // Auto-save every 5 minutes
  useEffect(() => {
    const interval = setInterval(saveSnapshot, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentData]);

  // Find historical data for comparison
  const getHistoricalData = (period) => {
    const now = Date.now();
    const periodMs = period === '1h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const threshold = now - periodMs;

    const historical = history.find(h => h.timestamp <= threshold);
    return historical?.data || null;
  };

  // Calculate percentage change
  const calculateChange = (current, historical) => {
    if (!historical) return null;

    const currentTotal = Object.values(current).reduce((sum, items) => {
      return sum + (Array.isArray(items) ? items.reduce((s, i) => s + Number(i.ordersInWindow || 0), 0) : 0);
    }, 0);

    const historicalTotal = Object.values(historical).reduce((sum, items) => {
      return sum + (Array.isArray(items) ? items.reduce((s, i) => s + Number(i.ordersInWindow || 0), 0) : 0);
    }, 0);

    if (historicalTotal === 0) return currentTotal > 0 ? 100 : 0;

    const change = ((currentTotal - historicalTotal) / historicalTotal) * 100;
    return Math.round(change * 10) / 10;
  };

  // Get comparisons for all periods
  const comparisons = useMemo(() => {
    const results = {};
    comparisonPeriods.forEach(period => {
      const historicalData = getHistoricalData(period);
      results[period] = {
        data: historicalData,
        change: calculateChange(currentData, historicalData)
      };
    });
    return results;
  }, [currentData, history]);

  // Get trend data for sparklines (last N snapshots)
  const getTrendData = (merchant, limit = 7) => {
    return history
      .slice(0, limit)
      .reverse()
      .map(h => {
        const merchantData = h.data?.[merchant] || [];
        const total = Array.isArray(merchantData)
          ? merchantData.reduce((s, i) => s + Number(i.ordersInWindow || 0), 0)
          : 0;
        return {
          timestamp: h.timestamp,
          value: total
        };
      });
  };

  return {
    history,
    saveSnapshot,
    comparisons,
    getTrendData,
    getHistoricalData,
    calculateChange
  };
}

/**
 * Hook for generating sparkline data from merchant activity
 */
export function useSparklineData(merchantData, options = {}) {
  const {
    points = 20,
    smoothing = true
  } = options;

  return useMemo(() => {
    if (!merchantData || merchantData.length === 0) return [];

    // Generate time-series data from merchant products
    const data = merchantData.map(item => ({
      product: item.product,
      orders: Number(item.ordersInWindow || 0),
      timestamp: Date.now()
    }));

    // Aggregate into time buckets for sparkline
    const buckets = [];
    const bucketSize = Math.max(1, Math.floor(data.length / points));

    for (let i = 0; i < data.length; i += bucketSize) {
      const bucket = data.slice(i, i + bucketSize);
      const total = bucket.reduce((s, d) => s + d.orders, 0);
      buckets.push({
        value: total,
        count: bucket.length
      });
    }

    return buckets;
  }, [merchantData, points]);
}

/**
 * Hook for merchant activity heatmap data
 */
export function useHeatmapData(merchantData) {
  return useMemo(() => {
    // Generate heatmap data based on product activity patterns
    // Hours (0-23) x Days (0-6, but we'll use single day view)
    const heatmap = Array(24).fill(null).map(() => Array(7).fill(0));

    if (!merchantData) return heatmap;

    // TODO: Use real historical data from backend instead of simulated distribution
    console.warn('[useHeatmapData] Using simulated heatmap data — replace with real historical data from backend');

    merchantData.forEach(item => {
      const orders = Number(item.ordersInWindow || 0);
      const currentHour = new Date().getHours();
      
      // Simulate distribution around current hour
      for (let h = 0; h < 24; h++) {
        const distance = Math.abs(h - currentHour);
        const weight = distance < 3 ? (3 - distance) / 3 : 0;
        heatmap[h][0] += Math.round(orders * weight);
      }
    });

    return heatmap;
  }, [merchantData]);
}

export default {
  useHistoricalComparison,
  useSparklineData,
  useHeatmapData
};
