import type { Connection } from './types';

/**
 * Type-checked identity helper. Doesn't transform the input — its
 * job is to give consumers full type inference on the literal config
 * object and to mark intent. `as const` is implicit via type widening.
 */
export function defineConnection<C extends Connection>(c: C): C {
  return c;
}
