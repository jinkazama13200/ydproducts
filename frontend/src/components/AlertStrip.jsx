import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { levelClass, levelLabel } from '../utils/levels';
import { containerVariants } from '../utils/animations';

export function AlertStrip({ topAlerts, rateWindow }) {
  const [expanded, setExpanded] = useState(false);

  if (!topAlerts || topAlerts.length === 0) return null;

  const MAX_COLLAPSED = 4;
  const displayed = expanded ? topAlerts : topAlerts.slice(0, MAX_COLLAPSED);
  const remaining = topAlerts.length - MAX_COLLAPSED;

  return (
    <AnimatePresence>
      <motion.div
        className="card alert-strip"
        style={{ marginBottom: 12 }}
        role="region"
        aria-label="Recent changes alerts"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="alert-strip-title">⚡ Mini alerts: merchant/product vừa thay đổi mạnh</div>
          {topAlerts.length > MAX_COLLAPSED && (
            <motion.button
              onClick={() => setExpanded(v => !v)}
              style={{ padding: '4px 12px', minWidth: 'auto', fontSize: 12, background: 'rgba(103,232,249,0.1)', border: '1px solid rgba(103,232,249,0.2)', color: '#67e8f9', borderRadius: 6 }}
              whileHover={{ background: 'rgba(103,232,249,0.2)' }}
              whileTap={{ scale: 0.97 }}
            >
              {expanded ? 'Show less' : `+${remaining} more`}
            </motion.button>
          )}
        </div>
        <motion.div
          className="alert-strip-list"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {displayed.map((row, idx) => {
            const alertKey = `${row.merchant}|||${row.product}|||${idx}`;
            return (
              <motion.div
                className={`alert-chip ${row.level || levelClass(row.ordersInWindow || 0)}`}
                key={alertKey}
                role="status"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <strong>{row.merchant || 'Unknown'}</strong>
                <span>{row.product || 'Unknown'}</span>
                <b>{row.ordersInWindow || 0}/{rateWindow}m</b>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default AlertStrip;