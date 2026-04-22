import React from 'react';

function formatFreshness(lastUpdate) {
  if (!lastUpdate) return null;
  const sec = Math.max(0, Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m`;
}

/**
 * ConnectionStatus - Badge showing real-time connection state
 *
 * 🟢 Live (connected, receiving push data)
 * 🟡 Using Cache (circuit breaker OPEN)
 * ⚪ Polling (disconnected, falling back to HTTP)
 */
export function ConnectionStatus({ status, circuitBreaker, usingCache, lastUpdate }) {
  let icon, label, className;

  if (status === 'connected' && circuitBreaker === 'CLOSED') {
    icon = '🟢';
    label = 'Live';
    className = 'connection-status live';
  } else if (usingCache || circuitBreaker === 'OPEN') {
    icon = '🟡';
    label = 'Using Cache';
    className = 'connection-status cache';
  } else {
    icon = '⚪';
    label = 'Polling';
    className = 'connection-status polling';
  }

  const freshness = formatFreshness(lastUpdate);
  const displayLabel = freshness ? `${label} · ${freshness}` : status === 'disconnected' ? `${label} · Connecting...` : label;

  return (
    <span
      className={className}
      role="status"
      aria-label={`Connection status: ${label}${freshness ? `, last update ${freshness} ago` : ''}`}
      title={`WebSocket: ${status} | Circuit Breaker: ${circuitBreaker} | ${usingCache ? 'Using cache' : 'Live data'}${freshness ? ` | Last push: ${freshness} ago` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: className === 'connection-status live'
          ? 'rgba(48, 209, 88, 0.15)'
          : className === 'connection-status cache'
          ? 'rgba(255, 159, 10, 0.15)'
          : 'rgba(0, 0, 0, 0.04)',
        color: className === 'connection-status live'
          ? '#30d158'
          : className === 'connection-status cache'
          ? '#ff9f0a'
          : 'rgba(0,0,0,.48)',
        border: `1px solid ${
          className === 'connection-status live'
          ? 'rgba(48, 209, 88, 0.3)'
          : className === 'connection-status cache'
          ? 'rgba(255, 159, 10, 0.3)'
          : 'rgba(0, 0, 0, 0.12)'
        }`,
        whiteSpace: 'nowrap',
      }}
    >
      {icon} {displayLabel}
    </span>
  );
}
