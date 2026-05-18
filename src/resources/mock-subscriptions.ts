import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'mock-subscriptions',
  connection: 'mock',
  name: 'Subscriptions',
  group: 'Mock CRM',
  list:   { method: 'GET', path: '/_mock/subscriptions' },
  detail: { method: 'GET', path: '/_mock/subscriptions/:id' },
  fields: [
    { key: 'id',                   label: 'ID',        type: 'string', primary: true, monospace: true, tableColumn: true },
    { key: 'customer_id',          label: 'Customer',  type: 'string', tableColumn: true, monospace: true },
    { key: 'plan',                 label: 'Plan',      type: 'string', tableColumn: true },
    { key: 'status',               label: 'Status',    type: 'string', tableColumn: true },
    { key: 'amount_cents',         label: 'Amount',    type: 'currency', tableColumn: true },
    { key: 'current_period_end',   label: 'Renews',    type: 'unix-ts', tableColumn: true },
    { key: 'created_at',           label: 'Started',   type: 'unix-ts' },
  ],
});
