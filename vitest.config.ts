import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import { resolve } from 'node:path';

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(resolve(__dirname, 'migrations'));
  return {
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            d1Databases: ['DB'],
            kvNamespaces: ['RATE_LIMIT', 'MAGIC_TOKENS'],
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
