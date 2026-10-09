import { describe, expect, it } from 'vitest';
import { formatIntOrDash, formatValueOrDash } from './formatValue.js';

describe('formatValueOrDash', () => {
  it('null이면 -', () => {
    expect(formatValueOrDash(null, '℃')).toBe('-');
  });

  it('소수 1자리 + 단위', () => {
    expect(formatValueOrDash(27.14, '℃')).toBe('27.1℃');
  });
});

describe('formatIntOrDash', () => {
  it('null이면 -', () => {
    expect(formatIntOrDash(null, '%')).toBe('-');
  });

  it('정수로 반올림 + 단위', () => {
    expect(formatIntOrDash(64.6, '%')).toBe('65%');
  });
});
