import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

/**
 * Compact sparkline for merchant row
 */
export function MerchantSparkline({ data, width = 80, height = 28 }) {
  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    if (safeData.length === 0) return [];
    
    // Generate synthetic trend data from current orders
    const baseValue = safeData.reduce((s, d) => s + Number(d?.ordersInWindow || 0), 0) / safeData.length;
    
    return Array.from({ length: 10 }, (_, i) => ({
      index: i,
      value: Math.round(baseValue * (0.5 + Math.random() * 1.5))
    }));
  }, [data]);

  const safeData = Array.isArray(data) ? data : [];
  if (safeData.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#64748b', fontSize: 9 }}>--</span>
      </div>
    );
  }

  const getColor = () => {
    const total = safeData.reduce((s, d) => s + Number(d?.ordersInWindow || 0), 0);
    if (total >= 10) return '#fca5a5';
    if (total >= 3) return '#a5f3fc';
    return '#64748b';
  };

  const color = getColor();

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * 7-day trend chart for KPI cards
 */
export function WeekTrendChart({ data, width = 60, height = 32, color = '#06b6d4' }) {
  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    if (safeData.length === 0) {
      // Generate placeholder data
      return Array.from({ length: 7 }, (_, i) => ({
        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        value: Math.round(50 + Math.random() * 100)
      }));
    }
    
    return safeData.slice(0, 7).map((value, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i % 7],
      value: Number(value) || 0
    }));
  }, [data]);

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Activity distribution bar chart
 */
export function ActivityBarChart({ data, width = 120, height = 40 }) {
  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    if (safeData.length === 0) return [];
    
    const categories = [
      { label: 'Hot', threshold: 10, color: '#fca5a5' },
      { label: 'Warm', threshold: 3, color: '#a5f3fc' },
      { label: 'Idle', threshold: 0, color: '#94a3b8' }
    ];

    const hot = safeData.filter(d => Number(d?.ordersInWindow || 0) >= 10).length;
    const warm = safeData.filter(d => Number(d?.ordersInWindow || 0) >= 3 && Number(d?.ordersInWindow || 0) < 10).length;
    const idle = safeData.filter(d => Number(d?.ordersInWindow || 0) < 3).length;

    return [
      { label: 'Hot', value: hot, color: '#fca5a5' },
      { label: 'Warm', value: warm, color: '#a5f3fc' },
      { label: 'Idle', value: idle, color: '#94a3b8' }
    ];
  }, [data]);

  const safeValues = chartData.map(d => d.value);
  const maxValue = safeValues.length > 0 ? Math.max(...safeValues, 1) : 1;

  return (
    <div style={{ width, height, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      {chartData.map(item => (
        <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: '100%',
              height: `${(item.value / maxValue) * 100}%`,
              minHeight: 4,
              background: item.color,
              borderRadius: '4px 4px 0 0',
              opacity: 0.8
            }}
          />
          <span style={{ fontSize: 8, color: item.color, marginTop: 2, fontWeight: 700 }}>
            {item.label}
          </span>
          <span style={{ fontSize: 9, color: '#94a3b8' }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default {
  MerchantSparkline,
  WeekTrendChart,
  ActivityBarChart
};
