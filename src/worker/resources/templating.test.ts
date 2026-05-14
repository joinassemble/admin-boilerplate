import { describe, expect, it } from 'vitest';
import { interpolatePath, TemplatingError } from './templating';

const session = { userId: 'ada@example.com', email: 'ada@example.com', orgId: 'lovelace', role: 'admin' };

describe('interpolatePath', () => {
  it('substitutes :session.* tokens', () => {
    expect(interpolatePath('/orgs/:session.orgId/things', session, {}, {})).toBe('/orgs/lovelace/things');
  });

  it('substitutes :param tokens from the params map', () => {
    expect(interpolatePath('/things/:id', session, {}, { id: 'thing_123' })).toBe('/things/thing_123');
  });

  it('substitutes :query.* tokens', () => {
    expect(interpolatePath('/list?since=:query.since', session, { since: '2024' }, {})).toBe('/list?since=2024');
  });

  it('handles multiple substitutions in one path', () => {
    expect(
      interpolatePath('/orgs/:session.orgId/things/:id', session, {}, { id: 't1' }),
    ).toBe('/orgs/lovelace/things/t1');
  });

  it('throws missing_session_field when :session.* key is missing', () => {
    const noOrg = { userId: 'x', email: 'x', orgId: null, role: null };
    expect(() => interpolatePath('/orgs/:session.orgId/things', noOrg, {}, {})).toThrow(TemplatingError);
  });

  it("leaves a literal colon-prefixed string alone if it doesn't match a known pattern", () => {
    // :bar isn't in any params map, so it stays literal.
    expect(interpolatePath('/foo/:bar', session, {}, {})).toBe('/foo/:bar');
  });
});
