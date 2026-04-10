import React from 'react';
import { motion } from 'framer-motion';
import { LevelIcon } from './LevelIcon';
import { levelClass, levelLabel } from '../utils/levels';
import { cardVariants } from '../utils/animations';

export function CardView({ merchantEntries, changedKeys, showLevelLabels, rateWindow, videoIconsEnabled }) {
  const safeRateWindow = rateWindow || 5;

  return (
    <motion.div
      className="grid"
      role="region"
      aria-label="Products cards view"
    >
      {merchantEntries.map(([merchant, items, sumOrders], idx) => {
        const safeItems = Array.isArray(items) ? items : [];
        const safeSumOrders = sumOrders || 0;

        return (
          <motion.div
            className="card fade-in"
            key={`card-${merchant}`}
            role="article"
            aria-label={`Merchant: ${merchant}`}
            variants={cardVariants}
            whileHover="hover"
          >
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + idx * 0.03 }}
            >
              {idx < 3 ? `🏆 ${merchant}` : merchant}
              <small>({safeSumOrders})</small>
            </motion.h3>
            {safeItems.slice(0, 6).map((x, i) => {
              const rowKey = `${merchant}|||${x.product || 'unknown'}`;
              const ordersVal = x.ordersInWindow || 0;
              const cls = `row lvl-row ${levelClass(ordersVal)} ${changedKeys?.has(rowKey) ? 'changed' : ''}`;
              return (
                <motion.div
                  className={cls}
                  key={rowKey}
                  role="listitem"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + idx * 0.03 + i * 0.02 }}
                  whileHover={{ backgroundColor: 'rgba(103,232,249,0.12)' }}
                >
                  <div className="name">
                    <LevelIcon n={ordersVal} showLabel={showLevelLabels} videoEnabled={videoIconsEnabled} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {x.product || 'Unknown product'}
                    </span>
                    <span className={`level-chip ${levelClass(ordersVal)}`}>{levelLabel(ordersVal)}</span>
                  </div>
                  <div className="rate">{ordersVal}/{safeRateWindow}m</div>
                </motion.div>
              );
            })}

            {safeItems.length > 6 && (
              <motion.p
                style={{ color: '#94a3b8', marginTop: 8, fontSize: 13 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                + {safeItems.length - 6} products khác
              </motion.p>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default CardView;