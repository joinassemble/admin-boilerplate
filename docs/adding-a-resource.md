# Adding a resource

Two file edits, no rebuild needed beyond `pnpm dev:all` hot-reload.

## 1. Define the resource

Create `src/resources/<id>.ts`. Example:

```ts
import { defineResource } from '../worker/resources/define';

export default defineResource({
  id: 'stripe-customers',
  connection: 'stripe',       // must match a connection in src/connections/
  name: 'Customers',
  group: 'Stripe',             // sidebar group; optional
  list:   { method: 'GET', path: '/v1/customers', dataPath: 'data', cursorParam: 'starting_after' },
  detail: { method: 'GET', path: '/v1/customers/:id' },
  // Mutations are opt-in: must set `enabled: true` for the route to be live.
  update: { method: 'POST',   path: '/v1/customers/:id', enabled: true },
  delete: { method: 'DELETE', path: '/v1/customers/:id', enabled: true },
  fields: [
    { key: 'id',      label: 'ID',     type: 'string', primary: true, monospace: true },
    { key: 'email',   label: 'Email',  type: 'email',  tableColumn: true, searchable: true },
    { key: 'name',    label: 'Name',   type: 'string', tableColumn: true, editable: true },
    { key: 'created', label: 'Joined', type: 'unix-ts', tableColumn: true, readOnly: true },
  ],
});
```

## 2. Register it

Edit `src/resources/index.ts` and add the import + array entry:

```ts
import stripeCustomers from './stripe-customers';

export const resources: Resource[] = [
  jsonplaceholderPosts,
  stripeCustomers,         // ← add here
];
```

## 3. (If new connection) define the connection

If the resource references a connection that doesn't exist yet, also:

- Create `src/connections/<id>.ts`
- Register it in `src/connections/index.ts`
- After redeploy, configure the secret via Settings → Connections.

## Field types

`string | text | email | url | number | integer | boolean | date | unix-ts | enum | json | image-url | currency`

Each field also accepts: `tableColumn`, `searchable`, `editable`, `readOnly`, `required`, `primary`, `monospace`, `collapsible`, `format`, `enumOptions`.

## Templating

Paths support these placeholders:

- `:id` (or any `:paramName`) — record id / route param
- `:query.<key>` — URL query param
- `:session.userId | email | orgId | role` — current session metadata. **Used for row-level scoping in multi-tenant forks** (e.g. `path: '/orgs/:session.orgId/projects'`). If a session field is null, the request is rejected with 403.
