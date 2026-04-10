import { describe, it, expect, beforeEach } from 'vitest';
import { obfuscate, deobfuscate, safeGetItem, safeSetItem } from '../utils/storage';

// Mock localStorage for jsdom
beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
});

describe('storage — obfuscation', () => {
  it('should round-trip a token', () => {
    const token = 'abc123xyz789';
    const encoded = obfuscate(token);
    expect(encoded).not.toBe(token);
    expect(deobfuscate(encoded)).toBe(token);
  });

  it('should handle empty strings', () => {
    expect(obfuscate('')).toBe('');
    expect(deobfuscate('')).toBe('');
  });

  it('should handle null/undefined', () => {
    expect(obfuscate(null)).toBe('');
    expect(obfuscate(undefined)).toBe('');
    expect(deobfuscate(null)).toBe('');
    expect(deobfuscate(undefined)).toBe('');
  });

  it('should produce different output than plaintext', () => {
    const secret = 'my-secret-token-12345';
    const encoded = obfuscate(secret);
    expect(encoded).not.toContain('secret');
    expect(encoded).not.toContain('token');
  });
});

describe('storage — safe localStorage', () => {
  it('should return fallback for missing keys', () => {
    const result = safeGetItem('nonexistent_key_' + Date.now(), 'default');
    expect(result).toBe('default');
  });

  it('should set and get items', () => {
    const key = 'test_' + Date.now();
    safeSetItem(key, { foo: 'bar' });
    const result = safeGetItem(key);
    expect(result).toEqual({ foo: 'bar' });
  });
});