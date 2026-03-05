import { describe, expect, it } from 'vitest';

import { cn, debounceValue, formatDate } from './utils';

describe('utils', () => {
  it('returns dash for missing date', () => {
    expect(formatDate(undefined)).toBe('-');
    expect(formatDate(null)).toBe('-');
  });

  it('merges class names and tailwind conflicts', () => {
    expect(cn('p-2', false && 'hidden', 'p-4')).toBe('p-4');
  });

  it('resolves debounce value after delay', async () => {
    const value = await debounceValue('ok', 10);
    expect(value).toBe('ok');
  });
});
