import React from 'react';

/**
 * ConnectionStatus - Simple badge showing WebSocket connection status
 *
 * 🟢 Live (connected, circuit breaker CLOSED)
 * 🟡 Using Cache (circuit breaker OPEN)
 * ⚪ Polling (disconnected)
 */
export function ConnectionStatus({ status, circuitBreaker, usingCache }) {
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

  return (
    <span
      className={className}
      role="status"
      aria-label={`Connection status: ${label}`}
      title={`WebSocket: ${status} | Circuit Breaker: ${circuitBreaker} | ${usingCache ? 'Using cache' : 'Live data'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: className === 'connection-status live'
          ? 'rgba(16, 185, 129, 0.15)'
          : className === 'connection-status cache'
          ? 'rgba(234, 179, 8, 0.15)'
          : 'rgba(148, 163, 184, 0.15)',
        color: className === 'connection-status live'
          ? '#10b981'
          : className === 'connection-status cache'
          ? '#eab308'
          : '#94a3b8',
        border: `1px solid ${
          className === 'connection-status live'
          ? 'rgba(16, 185, 129, 0.3)'
          : className === 'connection-status cache'
          ? 'rgba(234, 179, 8, 0.3)'
          : 'rgba(148, 163, 184, 0.3)'
        }`,
        whiteSpace: 'nowrap',
      }}
    >
      {icon} {label}
    </span>
  );
}