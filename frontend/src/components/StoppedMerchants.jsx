import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buttonVariants } from '../utils/animations';

export function StoppedMerchants({ stoppedMerchants, showStopped, setShowStopped, addToast }) {
  if (!stoppedMerchants || stoppedMerchants.length === 0) return null;

  return (
    <motion.div
      className="stopped-section card"
      style={{ marginTop: 16 }}
      role="region"
      aria-label="Stopped merchants"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="hero-actions" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <motion.h3 style={{ margin: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          🔴 Merchant đang dừng ({stoppedMerchants.length})
        </motion.h3>
        <motion.button
          onClick={() => setShowStopped(v => !v)}
          aria-expanded={showStopped}
          aria-controls="stopped-list"
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
        >
          {showStopped ? 'Hide' : 'Show'}
        </motion.button>
      </div>
      <p style={{ color: '#6e6e73', fontSize: 13, margin: '4px 0 8px' }}>Không có product nào chạy trong 10 phút qua</p>
      <AnimatePresence>
        {showStopped && (
          <motion.div
            className="stopped-list"
            id="stopped-list"
            role="list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {stoppedMerchants.map(([merchant, , , , totalProducts]) => (
              <motion.span
                className="stopped-tag"
                key={merchant}
                role="listitem"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
              >
                {merchant} <small>({totalProducts} products)</small>
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default StoppedMerchants;