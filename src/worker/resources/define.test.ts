import { describe, expect, it } from 'vitest';
import { defineResource } from './define';

describe('defineResource', () => {
  it('returns the resource object verbatim', () => {
    const r = defineResource({
      id: 'stripe-customers',
      connection: 'stripe',
      name: 'Customers',
      list: { method: 'GET', path: '/v1/customers', dataPath: 'data' },
      detail: { method: 'GET', path: '/v1/customers/:id' },
      fields: [
        { key: 'id', label: 'ID', type: 'string', primary: true },
        { key: 'email', label: 'Email', type: 'email', tableColumn: true },
      ],
    });
    expect(r.id).toBe('stripe-customers');
    expect(r.fields).toHaveLength(2);
    expect(r.list.dataPath).toBe('data');
  });
});
