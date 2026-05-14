// src/resources/jsonplaceholder-posts.ts
import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'jsonplaceholder-posts',
  connection: 'jsonplaceholder',
  name: 'Posts',
  group: 'JSONPlaceholder',
  list:   { method: 'GET', path: '/posts' },
  detail: { method: 'GET', path: '/posts/:id' },
  // JSONPlaceholder accepts these but doesn't actually persist — fine for a demo.
  create: { method: 'POST',   path: '/posts',     enabled: true },
  update: { method: 'PATCH',  path: '/posts/:id', enabled: true },
  delete: { method: 'DELETE', path: '/posts/:id', enabled: true },
  fields: [
    { key: 'id',     label: 'ID',     type: 'integer', primary: true, readOnly: true, tableColumn: true },
    { key: 'userId', label: 'User',   type: 'integer', tableColumn: true, editable: true },
    { key: 'title',  label: 'Title',  type: 'string',  tableColumn: true, searchable: true, editable: true, required: true },
    { key: 'body',   label: 'Body',   type: 'text',    editable: true },
  ],
});
