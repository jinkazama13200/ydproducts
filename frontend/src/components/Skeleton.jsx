import React from 'react';
import { motion } from 'framer-motion';

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
    background: 'linear-gradient(90deg, #302c2c 25%, #3a3535 50%, #302c2c 75%)',
    backgroundSize: '200% 100%',
    borderRadius: '4px'
  };

  const variantStyles = {
    rectangular: {},
    circular: { borderRadius: '50%' },
    text: { height: '1em', maxWidth: '80%' },
    card: {
      borderRadius: '4px',
      background: 'linear-gradient(180deg, #302c2c, #302c2c)',
      border: '1px solid rgba(15,0,0,0.12)'
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

function SkeletonKPI({ count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="kpi-card"
          style={{
            background: '#302c2c',
            border: '1px solid rgba(15,0,0,0.12)',
            borderRadius: '4px',
            padding: '14px',
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
            gap: '10px',
            padding: '10px 8px',
            borderBottom: '1px solid rgba(15,0,0,0.12)'
          }}
        >
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              style={{
                height: '20px',
                background: '#3a3535',
                borderRadius: '4px',
                flex: j === 1 ? '1.5' : '1'
              }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function SkeletonCardGrid({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-card"
          style={{
            background: '#302c2c',
            border: '1px solid rgba(15,0,0,0.12)',
            borderRadius: '4px',
            padding: '14px',
            minHeight: '200px'
          }}
        >
          <Skeleton width="70%" height="20px" style={{ marginBottom: '12px' }} />
          <Skeleton width="100%" height="16px" style={{ marginBottom: '8px' }} />
          <Skeleton width="100%" height="16px" style={{ marginBottom: '8px' }} />
          <Skeleton width="80%" height="16px" />
        </div>
      ))}
    </>
  );
}

function SkeletonToolbar() {
  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <Skeleton width="100%" height="44px" style={{ flex: 1 }} />
        <Skeleton width="100px" height="44px" />
        <Skeleton width="100px" height="44px" />
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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