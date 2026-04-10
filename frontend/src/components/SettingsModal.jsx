import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { backdropVariants, modalVariants } from '../utils/animations';

export function SettingsModal({
  open,
  onClose,
  cfg,
  setCfg,
  onSave,
  tokenVisible,
  setTokenVisible,
  internalKeyVisible,
  setInternalKeyVisible,
  wsStatus,
  wsCircuitBreaker,
  wsUsingCache,
  wsLastUpdate,
}) {
  const modalContentRef = useRef(null);
  const settingsTriggerRef = useRef(null);

  // Focus trap
  useEffect(() => {
    if (!open) return;

    settingsTriggerRef.current = document.activeElement;

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const modalContent = modalContentRef.current;
      if (!modalContent) return;

      const focusable = modalContent.querySelectorAll(focusableSelectors.join(','));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const modalContent = modalContentRef.current;
    if (modalContent) {
      const focusable = modalContent.querySelectorAll(focusableSelectors.join(','));
      if (focusable.length > 0) focusable[0].focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (settingsTriggerRef.current) {
        settingsTriggerRef.current.focus();
      }
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            className="modal-content"
            ref={modalContentRef}
            onClick={e => e.stopPropagation()}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="modal-header">
              <motion.h2 id="settings-title" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                ⚙️ Settings
              </motion.h2>
              <button onClick={onClose} className="modal-close" aria-label="Close settings">✕</button>
            </div>
            <div className="modal-body">
              <motion.div className="settings-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <h3>🔑 API Configuration</h3>
                <div className="form-row">
                  <label htmlFor="token-input">Token</label>
                  <input
                    id="token-input"
                    type={tokenVisible ? 'text' : 'password'}
                    value={cfg.token}
                    onChange={e => setCfg({ ...cfg, token: e.target.value })}
                    placeholder="x-product-token"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="internal-key-input">Internal Key</label>
                  <input
                    id="internal-key-input"
                    type={internalKeyVisible ? 'text' : 'password'}
                    value={cfg.internalKey}
                    onChange={e => setCfg({ ...cfg, internalKey: e.target.value })}
                    placeholder="x-internal-key"
                  />
                </div>
                <div className="hero-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                  <button onClick={() => setTokenVisible(v => !v)}>{tokenVisible ? '🙈 Hide' : '👁 Show'} Token</button>
                  <button onClick={() => setInternalKeyVisible(v => !v)}>{internalKeyVisible ? '🙈 Hide' : '👁 Show'} Key</button>
                </div>
              </motion.div>

              <motion.div className="settings-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <h3>🔔 Notifications</h3>
                <label className="chk">
                  <input type="checkbox" checked={cfg.soundEnabled} onChange={e => setCfg({ ...cfg, soundEnabled: e.target.checked })} />
                  🔊 Sound Alerts
                </label>
                <label className="chk">
                  <input type="checkbox" checked={cfg.toastEnabled} onChange={e => setCfg({ ...cfg, toastEnabled: e.target.checked })} />
                  💬 Toast Notifications
                </label>
              </motion.div>

              <motion.div className="settings-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <h3>🎨 Display</h3>
                <label className="chk">
                  <input type="checkbox" checked={cfg.videoIconsEnabled} onChange={e => setCfg({ ...cfg, videoIconsEnabled: e.target.checked })} />
                  🎬 Video Level Icons
                </label>
                <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>Enable animated video icons for levels (uses more bandwidth)</small>
              </motion.div>

              <motion.div className="settings-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h3>📡 Connection</h3>
                <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8' }}>WebSocket</span>
                    <span style={{ color: wsStatus === 'connected' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {wsStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8' }}>Circuit Breaker</span>
                    <span style={{ color: wsCircuitBreaker === 'CLOSED' ? '#10b981' : wsCircuitBreaker === 'OPEN' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                      {wsCircuitBreaker}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8' }}>Using Cache</span>
                    <span style={{ color: wsUsingCache ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                      {wsUsingCache ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {wsLastUpdate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#94a3b8' }}>Last Update</span>
                      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                        {new Date(wsLastUpdate).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div className="settings-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <h3>⌨️ Keyboard Shortcuts</h3>
                <div className="shortcuts-grid">
                  <div><kbd>Ctrl+K</kbd> Focus Search</div>
                  <div><kbd>Ctrl+S</kbd> Open Settings</div>
                  <div><kbd>Ctrl+L</kbd> Clear Filters</div>
                  <div><kbd>↑</kbd> <kbd>↓</kbd> Navigate</div>
                  <div><kbd>H</kbd> Hot Filter</div>
                  <div><kbd>W</kbd> Warm Filter</div>
                  <div><kbd>R</kbd> Refresh</div>
                </div>
              </motion.div>
            </div>
            <motion.div className="modal-footer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <button onClick={onClose}>Cancel</button>
              <button onClick={onSave} className="primary">💾 Save</button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SettingsModal;