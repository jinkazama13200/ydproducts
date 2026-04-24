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
        const topLevel = safeItems.reduce((max, x) => {
          const v = x.ordersInWindow || 0;
          return v > max ? v : max;
        }, 0);
        const topClass = levelClass(topLevel);

        return (
          <motion.div
            className="card product-card"
            key={`card-${merchant}`}
            role="article"
            aria-label={`Merchant: ${merchant}`}
            variants={cardVariants}
            whileHover="hover"
            initial="hidden"
            animate="visible"
          >
            {/* Card Header */}
            <div className="product-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 20 }}>{idx < 3 ? '🏆' : '🏪'}</span>
                <h3 className="product-card-title">{merchant}</h3>
              </div>
              <span className={`product-card-badge ${topClass}`}>{safeSumOrders}</span>
            </div>

            {/* Product Rows */}
            <div className="product-card-body">
              {safeItems.slice(0, 6).map((x, i) => {
                const rowKey = `${merchant}|||${x.product || 'unknown'}`;
                const ordersVal = x.ordersInWindow || 0;
                const cls = levelClass(ordersVal);
                const isChanged = changedKeys?.has(rowKey);

                return (
                  <motion.div
                    className={`product-row ${isChanged ? 'changed' : ''}`}
                    key={rowKey}
                    role="listitem"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + idx * 0.03 + i * 0.02 }}
                  >
                    <div className="product-row-left">
                      <span className={`lvl ${cls}`}>
                        <LevelIcon n={ordersVal} showLabel={showLevelLabels} videoEnabled={videoIconsEnabled} />
                      </span>
                      <span className="product-row-name">{x.product || 'Unknown product'}</span>
                    </div>
                    <div className="product-row-right">
                      <span className={`product-row-rate ${cls}`}>{ordersVal}<small>/{safeRateWindow}m</small></span>
                      <span className={`level-chip ${cls}`}>{levelLabel(ordersVal)}</span>
                    </div>
                  </motion.div>
                );
              })}

              {safeItems.length > 6 && (
                <div className="product-row-more">
                  + {safeItems.length - 6} products khác
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default CardView;