import { describe, it, expect } from 'vitest';
import { levelClass, levelLabel } from '../utils/levels';

describe('levelClass', () => {
  it('should return "hot" for 10+ orders', () => {
    expect(levelClass(10)).toBe('hot');
    expect(levelClass(15)).toBe('hot');
    expect(levelClass(100)).toBe('hot');
  });

  it('should return "warm" for 3-9 orders', () => {
    expect(levelClass(3)).toBe('warm');
    expect(levelClass(5)).toBe('warm');
    expect(levelClass(9)).toBe('warm');
  });

  it('should return "idle" for 0-2 orders', () => {
    expect(levelClass(0)).toBe('idle');
    expect(levelClass(1)).toBe('idle');
    expect(levelClass(2)).toBe('idle');
  });

  it('should handle edge cases', () => {
    expect(levelClass(-1)).toBe('idle');
    expect(levelClass(NaN)).toBe('idle');
  });
});

describe('levelLabel', () => {
  it('should return correct labels', () => {
    expect(levelLabel(10)).toBe('Hot');
    expect(levelLabel(5)).toBe('Warm');
    expect(levelLabel(0)).toBe('Idle');
  });
});