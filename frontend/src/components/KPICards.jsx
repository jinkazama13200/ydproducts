import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import { containerVariants, cardVariants } from '../utils/animations';

export function KPICards({ kpis, rateWindow }) {
  return (
    <motion.div
      className="summary card"
      style={{ marginBottom: 12 }}
      role="region"
      aria-label="Summary statistics"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {kpis.map((kpi, i) => (
        <motion.div
          key={i}
          className={`kpi-card ${kpi.primary ? 'primary' : ''} ${kpi.accent ? 'accent' : ''}`}
          role="status"
          variants={cardVariants}
          whileHover="hover"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '110px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}
            >
              {kpi.label}
            </motion.span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <motion.b
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.05, type: 'spring', stiffness: 300 }}
              style={{ fontSize: 24, color: '#f8fdff', lineHeight: 1.2 }}
            >
              {typeof kpi.value === 'number' ? <AnimatedNumber value={kpi.value} /> : kpi.value}
            </motion.b>
          </div>
          <motion.small
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.78 }}
            transition={{ delay: 0.3 + i * 0.05 }}
            style={{ display: 'block', color: '#7dd3fc', fontSize: 11, marginTop: 6, lineHeight: 1.35 }}
          >
            {kpi.desc}
          </motion.small>
        </motion.div>
      ))}
    </motion.div>
  );
}

export default KPICards;