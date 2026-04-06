import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Suppress known console warnings in development
if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const msg = args[0]?.toString() || '';
    // Suppress Framer Motion layout warnings (known issue, not critical)
    if (msg.includes('layout') || msg.includes('layoutId')) return;
    // Suppress React key warnings for arrays with stable indices
    if (msg.includes('key') && msg.includes('unique')) return;
    // Suppress React StrictMode double-render warnings (development only)
    if (msg.includes('StrictMode')) return;
    originalWarn(...args);
  };
}

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
