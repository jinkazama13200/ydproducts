import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

/**
 * Compact sparkline for merchant row
 * Shows real data if available, placeholder if empty
 */
export function MerchantSparkline({ data, width = 80, height = 28 }) {
  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    if (safeData.length === 0) return [];

    // Use real ordersInWindow values
    return safeData.map((item, i) => ({
      index: i,
      value: Number(item?.ordersInWindow || 0)
    }));
  }, [data]);

  const safeData = Array.isArray(data) ? data : [];
  if (safeData.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6e6e73', fontSize: 9 }}>--</span>
      </div>
    );
  }

  const total = safeData.reduce((s, d) => s + Number(d?.ordersInWindow || 0), 0);
  const color = total >= 10 ? '#ff3b30' : total >= 3 ? '#30d158' : '#9a9898';

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
 * Shows real data if provided, "No data" placeholder if empty
 */
export function WeekTrendChart({ data, width = 60, height = 32, color = '#007aff' }) {
  const chartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    if (safeData.length === 0) return null;

    return safeData.slice(0, 7).map((value, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i % 7],
      value: Number(value) || 0
    }));
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6e6e73', fontSize: 9 }}>--</span>
      </div>
    );
  }

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

    const hot = safeData.filter(d => Number(d?.ordersInWindow || 0) >= 10).length;
    const warm = safeData.filter(d => Number(d?.ordersInWindow || 0) >= 3 && Number(d?.ordersInWindow || 0) < 10).length;
    const idle = safeData.filter(d => Number(d?.ordersInWindow || 0) < 3).length;

    return [
      { label: 'Hot', value: hot, color: '#ff3b30' },
      { label: 'Warm', value: warm, color: '#30d158' },
      { label: 'Idle', value: idle, color: '#9a9898' }
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
          <span style={{ fontSize: 9, color: '#9a9898' }}>
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