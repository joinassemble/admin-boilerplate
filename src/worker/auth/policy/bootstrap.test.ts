import { describe, expect, it } from 'vitest';
import { isBootstrapAdmin, parseAdminEmails } from './bootstrap';

describe('bootstrap admin', () => {
  it('parseAdminEmails handles comma-separated input + lowercases + trims', () => {
    expect(parseAdminEmails(' Ada@Example.com , bob@example.com ')).toEqual([
      'ada@example.com',
      'bob@example.com',
    ]);
  });

  it('parseAdminEmails returns empty array for undefined or empty input', () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails('')).toEqual([]);
    expect(parseAdminEmails('   ')).toEqual([]);
  });

  it('isBootstrapAdmin matches case-insensitively', () => {
    expect(isBootstrapAdmin('ADA@example.com', 'ada@example.com,bob@example.com')).toBe(true);
    expect(isBootstrapAdmin('eve@example.com', 'ada@example.com,bob@example.com')).toBe(false);
  });
});
