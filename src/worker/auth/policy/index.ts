import { DomainAllowlistPolicy } from './domain-allowlist';
import { EnvAllowlistPolicy } from './env-allowlist';
import { OpenRegistrationPolicy } from './open-registration';
import type { AccessPolicy } from './types';

export type { AccessPolicy, AccessDecision, AccessContext } from './types';

export function getAccessPolicy(env: Env): AccessPolicy {
  const which = env.ACCESS_POLICY ?? 'allowlist';
  switch (which) {
    case 'allowlist':
      return new EnvAllowlistPolicy(env);
    case 'domain':
      return new DomainAllowlistPolicy(env.DB, env);
    case 'open':
      return new OpenRegistrationPolicy(env.DB, env);
    default:
      throw new Error(`Unknown ACCESS_POLICY: ${which}. Expected one of: allowlist, domain, open.`);
  }
}
