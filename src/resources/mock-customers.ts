import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'mock-customers',
  connection: 'mock',
  name: 'Customers',
  group: 'Mock CRM',
  list:   { method: 'GET', path: '/_mock/customers' },
  detail: { method: 'GET', path: '/_mock/customers/:id' },
  fields: [
    { key: 'id',         label: 'ID',      type: 'string', primary: true, monospace: true, tableColumn: true },
    { key: 'email',      label: 'Email',   type: 'email',  tableColumn: true, searchable: true },
    { key: 'name',       label: 'Name',    type: 'string', tableColumn: true },
    { key: 'city',       label: 'City',    type: 'string', tableColumn: true },
    { key: 'plan',       label: 'Plan',    type: 'string', tableColumn: true },
    { key: 'mrr_cents',  label: 'MRR',     type: 'currency', tableColumn: true },
    { key: 'status',     label: 'Status',  type: 'enum',   tableColumn: true,
      enumOptions: [
        { value: 'active',    label: 'Active' },
        { value: 'past_due',  label: 'Past due' },
        { value: 'canceled',  label: 'Canceled' },
        { value: 'trialing',  label: 'Trialing' },
      ] },
    { key: 'created_at', label: 'Joined',  type: 'unix-ts', tableColumn: true },
  ],
});
