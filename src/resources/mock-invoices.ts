import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'mock-invoices',
  connection: 'mock',
  name: 'Invoices',
  group: 'Mock CRM',
  list:   { method: 'GET', path: '/_mock/invoices' },
  detail: { method: 'GET', path: '/_mock/invoices/:id' },
  fields: [
    { key: 'id',           label: 'ID',        type: 'string', primary: true, monospace: true, tableColumn: true },
    { key: 'customer_id',  label: 'Customer',  type: 'string', tableColumn: true, monospace: true },
    { key: 'amount_cents', label: 'Amount',    type: 'currency', tableColumn: true },
    { key: 'status',       label: 'Status',    type: 'string', tableColumn: true },
    { key: 'due_at',       label: 'Due',       type: 'unix-ts', tableColumn: true },
    { key: 'paid_at',      label: 'Paid',      type: 'unix-ts', tableColumn: true },
  ],
});
