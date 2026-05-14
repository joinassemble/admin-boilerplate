import type { Resource } from './types';

export function defineResource<R extends Resource>(r: R): R {
  return r;
}
