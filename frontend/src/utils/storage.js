/**
 * Safe localStorage utilities with token obfuscation
 * (Not encryption — client-side can't truly encrypt — but prevents trivial reading)
 */

const STORAGE_PREFIX = 'yd_';

/**
 * Simple XOR + base64 obfuscation for sensitive values like tokens
 */
const OBFUSCATION_KEY = 'ydproducts2026';

export function obfuscate(value) {
  if (!value) return '';
  const encoded = [];
  for (let i = 0; i < value.length; i++) {
    encoded.push(String.fromCharCode(value.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)));
  }
  return btoa(encoded.join(''));
}

export function deobfuscate(encoded) {
  if (!encoded) return '';
  try {
    const decoded = atob(encoded);
    const result = [];
    for (let i = 0; i < decoded.length; i++) {
      result.push(String.fromCharCode(decoded.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)));
    }
    return result.join('');
  } catch {
    return '';
  }
}

export function safeGetItem(key, fallback = null) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * Save config with obfuscated token/internalKey
 */
export function saveConfig(cfg) {
  const toSave = {
    ...cfg,
    token: cfg.token ? obfuscate(cfg.token) : '',
    internalKey: cfg.internalKey ? obfuscate(cfg.internalKey) : '',
  };
  return safeSetItem('webCfg', toSave);
}

/**
 * Load config with deobfuscated token/internalKey
 */
export function loadConfig(defaults) {
  const raw = safeGetItem('webCfg');
  if (!raw) return { ...defaults };
  return {
    ...defaults,
    ...raw,
    token: raw.token ? deobfuscate(raw.token) : '',
    internalKey: raw.internalKey ? deobfuscate(raw.internalKey) : '',
  };
}