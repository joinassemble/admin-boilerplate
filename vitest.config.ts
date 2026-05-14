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
            // TEST_MIGRATIONS is consumed by ./test/apply-migrations.ts.
            // ADMIN_EMAILS is set explicitly here so test outcomes don't
            // depend on whether .dev.vars happens to be loaded — the
            // magic-link callback test fakes a token for `dev@localhost`
            // and needs the policy to recognise it as a bootstrap admin.
            // PUBLIC_URL is intentionally empty so the magic-link tests
            // exercise the request-origin fallback path. `.dev.vars`'s
            // value (used by `pnpm dev:all`) does not apply in test mode.
            bindings: {
              TEST_MIGRATIONS: migrations,
              ADMIN_EMAILS: 'dev@localhost',
              PUBLIC_URL: '',
              SECRETS_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            },
          },
        },
      },
    },
  };
});
