import React from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Sparkline component for showing trends in compact spaces
 */
export function SparklineChart({ data, width = 100, height = 40, color = '#06b6d4' }) {
  if (!data || data.length === 0) {
    return <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11 }}>No data</div>;
  }

  const chartData = data.map((value, index) => ({
    index,
    value: Number(value) || 0
  }));

  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${color})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Percentage change indicator with arrow and color coding
 */
export function ChangeIndicator({ value, suffix = '', showZero = false }) {
  if (value === null || value === undefined) {
    return <span style={{ color: '#64748b', fontSize: 11 }}>--</span>;
  }

  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = value === 0;

  if (!showZero && isZero) {
    return <span style={{ color: '#64748b', fontSize: 11 }}>0%</span>;
  }

  const color = isPositive ? '#10b981' : isNegative ? '#ef4444' : '#94a3b8';
  const arrow = isPositive ? '↑' : isNegative ? '↓' : '→';

  return (
    <span style={{ 
      color, 
      fontSize: 11, 
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2
    }}>
      {arrow} {Math.abs(value)}{suffix}
    </span>
  );
}

/**
 * KPI Card with mini trend chart
 */
export function KPITrendCard({ title, value, trendData, change, subtitle, color = '#06b6d4' }) {
  return (
    <div className="kpi-card" style={{
      background: 'linear-gradient(180deg, rgba(8,22,40,.9), rgba(12,31,56,.78))',
      border: '1px solid rgba(103,232,249,.12)',
      borderRadius: 14,
      padding: 14,
      minHeight: 96,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ color: '#8faec6', fontSize: 12 }}>{title}</span>
        {change !== null && change !== undefined && (
          <ChangeIndicator value={change} suffix="%" />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <b style={{ fontSize: 24, color: '#f8fdff', lineHeight: 1.2 }}>{value}</b>
        {trendData && trendData.length > 0 && (
          <SparklineChart data={trendData} width={80} height={32} color={color} />
        )}
      </div>
      {subtitle && (
        <small style={{ display: 'block', color: '#7dd3fc', fontSize: 11, opacity: 0.78, marginTop: 6, lineHeight: 1.35 }}>
          {subtitle}
        </small>
      )}
    </div>
  );
}

/**
 * Merchant Activity Heatmap
 */
export function ActivityHeatmap({ data, width = '100%', height = 200 }) {
  const safeData = Array.isArray(data) ? data : [];
  const flattened = safeData.flat().filter(v => v !== undefined && v !== null);
  const maxValue = flattened.length > 0 ? Math.max(...flattened, 1) : 1;
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getColor = (value) => {
    if (value === 0) return 'rgba(30, 41, 59, 0.5)';
    const intensity = value / maxValue;
    if (intensity > 0.8) return 'rgba(239, 68, 68, 0.8)';
    if (intensity > 0.6) return 'rgba(239, 68, 68, 0.6)';
    if (intensity > 0.4) return 'rgba(6, 182, 212, 0.6)';
    if (intensity > 0.2) return 'rgba(6, 182, 212, 0.4)';
    return 'rgba(6, 182, 212, 0.2)';
  };

  return (
    <div style={{ width, height, overflow: 'hidden' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '40px repeat(7, 1fr)', 
        gap: 2,
        height: '100%'
      }}>
        {/* Hour labels */}
        {hours.filter(h => h % 4 === 0).map(hour => (
          <div key={`hour-${hour}`} style={{
            gridColumn: 1,
            gridRow: hour + 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 8,
            color: '#64748b',
            fontSize: 10
          }}>
            {hour}:00
          </div>
        ))}

        {/* Heatmap cells */}
        {hours.map(hour => (
          <div
            key={hour}
            style={{
              gridColumn: 2,
              gridRow: hour + 1,
              background: getColor(safeData[hour]?.[0] || 0),
              borderRadius: 2,
              transition: 'background 0.3s ease'
            }}
            title={`${hour}:00 - ${safeData[hour]?.[0] || 0} orders`}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 8,
        fontSize: 10,
        color: '#64748b'
      }}>
        <span>Low</span>
        <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(6, 182, 212, 0.2)' }} />
        <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(6, 182, 212, 0.6)' }} />
        <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(239, 68, 68, 0.6)' }} />
        <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(239, 68, 68, 0.8)' }} />
        <span>High</span>
      </div>
    </div>
  );
}

/**
 * Historical Comparison Panel
 */
export function HistoricalComparison({ comparisons }) {
  if (!comparisons) return null;

  return (
    <div style={{
      display: 'flex',
      gap: 16,
      padding: '12px 16px',
      background: 'rgba(8, 22, 40, 0.6)',
      borderRadius: 12,
      border: '1px solid rgba(103, 232, 249, 0.1)',
      marginTop: 12
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#8faec6', marginBottom: 4 }}>vs 1 hour ago</div>
        <ChangeIndicator value={comparisons['1h']?.change} suffix="%" showZero />
      </div>
      <div style={{ width: 1, background: 'rgba(103, 232, 249, 0.1)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#8faec6', marginBottom: 4 }}>vs 24 hours ago</div>
        <ChangeIndicator value={comparisons['24h']?.change} suffix="%" showZero />
      </div>
    </div>
  );
}

/**
 * Merchant Trend Chart with recharts
 */
export function MerchantTrendChart({ data, height = 120 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        No trend data available
      </div>
    );
  }

  const chartData = data.map((point, index) => ({
    name: `${index + 1}`,
    orders: point.value || 0
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <XAxis dataKey="name" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(103, 232, 249, 0.2)',
            borderRadius: 8,
            fontSize: 12
          }}
          formatter={(value) => [`${value} orders`, 'Orders']}
        />
        <Line
          type="monotone"
          dataKey="orders"
          stroke="#06b6d4"
          strokeWidth={2}
          dot={{ fill: '#06b6d4', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default {
  SparklineChart,
  ChangeIndicator,
  KPITrendCard,
  ActivityHeatmap,
  HistoricalComparison,
  MerchantTrendChart
};
