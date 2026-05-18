import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'mock-activity',
  connection: 'mock',
  name: 'Activity',
  group: 'Mock CRM',
  list:   { method: 'GET', path: '/_mock/activity' },
  detail: { method: 'GET', path: '/_mock/activity/:id' },
  fields: [
    { key: 'id',           label: 'ID',        type: 'string', primary: true, monospace: true, tableColumn: true },
    { key: 'ts',           label: 'When',      type: 'unix-ts', tableColumn: true },
    { key: 'customer_id',  label: 'Customer',  type: 'string', tableColumn: true, monospace: true },
    { key: 'action',       label: 'Action',    type: 'string', tableColumn: true },
    { key: 'detail',       label: 'Detail',    type: 'string', tableColumn: true },
  ],
});
