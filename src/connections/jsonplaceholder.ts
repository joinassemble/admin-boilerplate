import { defineConnection } from '../worker/connections/define';

export default defineConnection({
  id: 'jsonplaceholder',
  name: 'JSONPlaceholder (example)',
  baseUrl: 'https://jsonplaceholder.typicode.com',
  auth: { type: 'none' },
});
