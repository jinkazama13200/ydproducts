import React from 'react';
import { motion } from 'framer-motion';

/**
 * ErrorState component - User-friendly error display with retry
 * Replaces generic error messages with actionable UI
 */
function ErrorState({ 
  error, 
  onRetry, 
  lastSuccessfulFetch,
  className = '',
  variant = 'inline' // 'inline' | 'fullscreen' | 'card'
}) {
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = now - then;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getErrorMessage = (err) => {
    if (!err) return 'An unexpected error occurred';
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    return 'An unexpected error occurred';
  };

  const getErrorIcon = (errorText) => {
    if (errorText?.toLowerCase().includes('network') || errorText?.toLowerCase().includes('fetch')) {
      return '📡';
    }
    if (errorText?.toLowerCase().includes('timeout')) {
      return '⏱️';
    }
    if (errorText?.toLowerCase().includes('unauthorized') || errorText?.toLowerCase().includes('token')) {
      return '🔐';
    }
    return '⚠️';
  };

  const errorText = getErrorMessage(error);
  const icon = getErrorIcon(errorText);

  const variants = {
    inline: {
      container: {
        padding: 'var(--space-4, 16px)',
        borderRadius: 'var(--radius-xl, 10px)',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3, 12px)',
        flexWrap: 'wrap'
      },
      message: { flex: '1 1 300px', color: '#fecaca', fontSize: 'var(--text-sm, 13px)', fontWeight: 'var(--font-medium, 500)' },
      button: { padding: '8px 16px', minHeight: 'auto', background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }
    },
    card: {
      container: {
        padding: 'var(--space-6, 24px)',
        borderRadius: 'var(--radius-4xl, 16px)',
        background: 'linear-gradient(180deg, rgba(127,29,29,0.15), rgba(69,10,10,0.2))',
        border: '2px solid rgba(239,68,68,0.3)',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
      },
      message: { color: '#fecaca', fontSize: 'var(--text-base, 14px)', fontWeight: 'var(--font-medium, 500)', marginBottom: 'var(--space-2, 8px)' },
      button: { padding: '12px 24px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }
    },
    fullscreen: {
      container: {
        padding: 'var(--space-8, 32px)',
        borderRadius: 'var(--radius-4xl, 16px)',
        background: 'linear-gradient(135deg, rgba(30,10,10,.92), rgba(20,8,8,.94))',
        border: '2px solid rgba(239,68,68,.4)',
        boxShadow: '0 20px 44px rgba(239,68,68,.16)',
        maxWidth: '520px',
        margin: '80px auto',
        textAlign: 'center'
      },
      message: { color: '#fecaca', fontSize: 'var(--text-lg, 16px)', marginBottom: 'var(--space-4, 16px)' },
      button: { padding: '14px 28px', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 8px 20px rgba(220,38,38,.24)' }
    }
  };

  const currentVariant = variants[variant] || variants.inline;

  return (
    <motion.div
      className={`error-state ${variant} ${className}`}
      style={currentVariant.container}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="alert"
      aria-live="assertive"
    >
      <span style={{ fontSize: '24px' }} role="img" aria-label="Error">
        {icon}
      </span>
      
      <div style={{ flex: 1 }}>
        <p style={currentVariant.message}>
          {errorText}
        </p>
        
        {lastSuccessfulFetch && (
          <small style={{ color: '#fca5a5', fontSize: 'var(--text-xs, 11px)', display: 'block', marginTop: '4px' }}>
            Last successful fetch: {formatTimeAgo(lastSuccessfulFetch)}
          </small>
        )}
      </div>
      
      {onRetry && (
        <motion.button
          onClick={onRetry}
          style={currentVariant.button}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.98 }}
          aria-label="Retry fetching data"
        >
          ↻ Retry
        </motion.button>
      )}
    </motion.div>
  );
}

/**
 * EmptyState component - For when there's no data (not an error)
 */
function EmptyState({ 
  title = 'No data available',
  message,
  icon = '📭',
  action,
  className = ''
}) {
  return (
    <motion.div
      className={`empty-state ${className}`}
      style={{
        padding: 'var(--space-8, 32px)',
        textAlign: 'center',
        color: 'var(--color-slate-400, #8a8f98)'
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      role="status"
    >
      <div style={{ fontSize: '48px', marginBottom: 'var(--space-4, 16px)' }} role="img" aria-label={icon}>
        {icon}
      </div>
      
      <h3 style={{ 
        margin: '0 0 var(--space-2, 8px) 0', 
        color: 'var(--color-slate-300, #d0d6e0)',
        fontSize: 'var(--text-lg, 16px)',
        fontWeight: 'var(--font-semibold, 600)'
      }}>
        {title}
      </h3>
      
      {message && (
        <p style={{ 
          margin: '0 0 var(--space-4, 16px) 0',
          color: 'var(--color-slate-400, #8a8f98)',
          fontSize: 'var(--text-sm, 13px)',
          maxWidth: '400px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          {message}
        </p>
      )}
      
      {action && (
        <motion.button
          onClick={action.onClick}
          style={{
            background: action.background || 'linear-gradient(135deg, #5e6ad2, #5e6ad2)',
            padding: '12px 24px',
            borderRadius: 'var(--radius-xl, 10px)',
            border: 'none',
            color: 'white',
            fontWeight: 'var(--font-bold, 700)',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(94,106,210,.18)'
          }}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}

/**
 * LoadingState component - For loading indicators
 */
function LoadingState({ 
  message = 'Loading...',
  variant = 'dots', // 'dots' | 'bar' | 'spinner'
  className = ''
}) {
  const dotVariants = {
    animate: {
      y: [0, -8, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    }
  };

  if (variant === 'bar') {
    return (
      <motion.div
        className={`loading-state bar ${className}`}
        style={{
          width: '100%',
          height: '4px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 'var(--radius-full, 9999px)',
          overflow: 'hidden'
        }}
        role="progressbar"
        aria-label={message}
      >
        <motion.div
          style={{
            width: '50%',
            height: '100%',
            background: 'linear-gradient(90deg, #5e6ad2, #22d3ee)',
            borderRadius: 'var(--radius-full, 9999px)'
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </motion.div>
    );
  }

  if (variant === 'spinner') {
    return (
      <div
        className={`loading-state spinner ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3, 12px)',
          padding: 'var(--space-6, 24px)',
          color: 'var(--color-slate-400, #8a8f98)'
        }}
        role="status"
      >
        <motion.div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(255,255,255,0.08)',
            borderTopColor: '#5e6ad2',
            borderRadius: '50%'
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
        {message && <span style={{ fontSize: 'var(--text-sm, 13px)' }}>{message}</span>}
      </div>
    );
  }

  // Default: dots variant
  return (
    <div
      className={`loading-state dots ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2, 8px)',
        padding: 'var(--space-3, 12px)',
        color: 'var(--color-slate-400, #8a8f98)'
      }}
      role="status"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={i}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-primary-400, #22d3ee)'
          }}
          variants={dotVariants}
          animate="animate"
          transition={{ delay: i * 0.15 }}
        />
      ))}
      {message && <span style={{ fontSize: 'var(--text-sm, 13px)', marginLeft: 'var(--space-2, 8px)' }}>{message}</span>}
    </div>
  );
}

export { ErrorState, EmptyState, LoadingState };
export default ErrorState;
