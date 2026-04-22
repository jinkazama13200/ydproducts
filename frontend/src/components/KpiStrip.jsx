import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';

export function KpiStrip({ items }) {
  return (
    <motion.div
      className="kpi-strip"
      role="region"
      aria-label="Key metrics"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {items.map((item, i) => (
        <motion.div
          key={i}
          className={`kpi-strip-item ${item.accent ? 'accent' : ''} ${item.primary ? 'primary' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 * i }}
        >
          <span className="kpi-strip-label">{item.icon} {item.label}</span>
          <span className="kpi-strip-value">
            {typeof item.value === 'number' ? <AnimatedNumber value={item.value} /> : item.value}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}

export default KpiStrip;