import React from 'react';
import { motion } from 'framer-motion';

/**
 * Skeleton loader component for loading states
 * Uses shimmer animation to indicate loading
 */
function Skeleton({ 
  width = '100%', 
  height = '20px', 
  className = '', 
  variant = 'rectangular',
  animationDuration = 1.5
}) {
  const variants = {
    animate: {
      backgroundPosition: ['200% 0', '-200% 0'],
      transition: {
        duration: animationDuration,
        ease: 'easeInOut',
        repeat: Infinity
      }
    }
  };

  const baseStyles = {
    width,
    height,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%',
    borderRadius: 'var(--radius-lg, 8px)'
  };

  const variantStyles = {
    rectangular: {},
    circular: { borderRadius: '50%' },
    text: { height: '1em', maxWidth: '80%' },
    card: { 
      borderRadius: 'var(--radius-4xl, 16px)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.02))',
      border: '1px solid rgba(255,255,255,0.08)'
    }
  };

  return (
    <motion.div
      className={`skeleton ${className}`}
      style={{ ...baseStyles, ...variantStyles[variant] }}
      variants={variants}
      animate="animate"
      role="status"
      aria-label="Loading..."
    />
  );
}

/**
 * KPI Card Skeleton - for dashboard metrics
 */
function SkeletonKPI({ count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i}
          className="kpi-card"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-3xl, 14px)',
            padding: 'var(--space-4, 14px)',
            minHeight: '96px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <Skeleton width="60%" height="14px" />
          <Skeleton width="80%" height="28px" />
          <Skeleton width="100%" height="12px" style={{ marginTop: '6px' }} />
        </div>
      ))}
    </>
  );
}

/**
 * Table Row Skeleton - for data tables
 */
function SkeletonTableRow({ count = 5, columns = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-table-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3, 10px)',
            padding: '10px 8px',
            borderBottom: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              style={{
                height: '20px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 'var(--radius-sm, 4px)',
                flex: j === 1 ? '1.5' : '1'
              }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * Card Grid Skeleton - for card layouts
 */
function SkeletonCardGrid({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-card"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-4xl, 16px)',
            padding: 'var(--space-4, 14px)',
            minHeight: '200px'
          }}
        >
          <Skeleton width="70%" height="20px" style={{ marginBottom: 'var(--space-3, 12px)' }} />
          <Skeleton width="100%" height="16px" style={{ marginBottom: 'var(--space-2, 8px)' }} />
          <Skeleton width="100%" height="16px" style={{ marginBottom: 'var(--space-2, 8px)' }} />
          <Skeleton width="80%" height="16px" />
        </div>
      ))}
    </>
  );
}

/**
 * Toolbar Skeleton - for filter/search controls
 */
function SkeletonToolbar() {
  return (
    <div className="card" style={{ marginBottom: 'var(--space-3, 12px)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3, 10px)', marginBottom: 'var(--space-3, 10px)' }}>
        <Skeleton width="100%" height="44px" style={{ flex: 1 }} />
        <Skeleton width="100px" height="44px" />
        <Skeleton width="100px" height="44px" />
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
        <Skeleton width="150px" height="36px" />
        <Skeleton width="150px" height="36px" />
        <Skeleton width="150px" height="36px" />
      </div>
    </div>
  );
}

export { 
  Skeleton, 
  SkeletonKPI, 
  SkeletonTableRow, 
  SkeletonCardGrid, 
  SkeletonToolbar 
};
export default Skeleton;
