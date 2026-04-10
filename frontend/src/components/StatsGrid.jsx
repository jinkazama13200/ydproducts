import React from 'react';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants } from '../utils/animations';

export function StatsGrid({ stats }) {
  return (
    <motion.div
      className="stats"
      style={{ marginBottom: 12 }}
      role="region"
      aria-label="Detailed statistics"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          className="stat"
          role="status"
          variants={itemVariants}
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(103,232,249,0.08)' }}
        >
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}
          >
            {stat.label}
          </motion.span>
          <motion.b
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            style={{ fontSize: 16, color: '#f8fdff', lineHeight: 1.35 }}
          >
            {stat.value}
          </motion.b>
        </motion.div>
      ))}
    </motion.div>
  );
}

export default StatsGrid;