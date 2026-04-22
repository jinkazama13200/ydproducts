import React from 'react';
import { motion } from 'framer-motion';

function ErrorState({
  error,
  onRetry,
  lastSuccessfulFetch,
  className = '',
  variant = 'inline'
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
        padding: '16px',
        borderRadius: '4px',
        background: 'rgba(255,59,48,0.08)',
        border: '1px solid rgba(255,59,48,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      },
      message: { flex: '1 1 300px', color: '#ff6b60', fontSize: '13px', fontWeight: '500' },
      button: { padding: '4px 20px', minHeight: 'auto', background: '#ff3b30' }
    },
    card: {
      container: {
        padding: '24px',
        borderRadius: '4px',
        background: '#302c2c',
        border: '1px solid rgba(255,59,48,0.3)'
      },
      message: { color: '#fdfcfc', fontSize: '14px', fontWeight: '500', marginBottom: '8px' },
      button: { padding: '4px 20px', background: '#ff3b30' }
    },
    fullscreen: {
      container: {
        padding: '32px',
        borderRadius: '4px',
        background: '#302c2c',
        border: '1px solid rgba(255,59,48,0.4)',
        maxWidth: '520px',
        margin: '80px auto',
        textAlign: 'center'
      },
      message: { color: '#fdfcfc', fontSize: '16px', marginBottom: '16px' },
      button: { padding: '4px 20px', background: '#ff3b30' }
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
          <small style={{ color: '#9a9898', fontSize: '11px', display: 'block', marginTop: '4px' }}>
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
        padding: '32px',
        textAlign: 'center',
        color: '#9a9898'
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      role="status"
    >
      <div style={{ fontSize: '48px', marginBottom: '16px' }} role="img" aria-label={icon}>
        {icon}
      </div>

      <h3 style={{
        margin: '0 0 8px 0',
        color: '#fdfcfc',
        fontSize: '16px',
        fontWeight: '700'
      }}>
        {title}
      </h3>

      {message && (
        <p style={{
          margin: '0 0 16px 0',
          color: '#9a9898',
          fontSize: '13px',
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
            background: action.background || '#007aff',
            padding: '4px 20px',
            borderRadius: '4px',
            border: 'none',
            color: '#fdfcfc',
            fontWeight: '500',
            cursor: 'pointer'
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

function LoadingState({
  message = 'Loading...',
  variant = 'dots',
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
          background: 'rgba(253,252,252,0.05)',
          borderRadius: '9999px',
          overflow: 'hidden'
        }}
        role="progressbar"
        aria-label={message}
      >
        <motion.div
          style={{
            width: '50%',
            height: '100%',
            background: '#007aff',
            borderRadius: '9999px'
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
          gap: '12px',
          padding: '24px',
          color: '#9a9898'
        }}
        role="status"
      >
        <motion.div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(15,0,0,0.12)',
            borderTopColor: '#007aff',
            borderRadius: '50%'
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
        {message && <span style={{ fontSize: '13px' }}>{message}</span>}
      </div>
    );
  }

  return (
    <div
      className={`loading-state dots ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        color: '#9a9898'
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
            background: '#007aff'
          }}
          variants={dotVariants}
          animate="animate"
          transition={{ delay: i * 0.15 }}
        />
      ))}
      {message && <span style={{ fontSize: '13px', marginLeft: '8px' }}>{message}</span>}
    </div>
  );
}

export { ErrorState, EmptyState, LoadingState };
export default ErrorState;