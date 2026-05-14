// Re-export only the SPA-safe portion of resource types so the client
// can render schemas without pulling in the Worker registry. Worker
// routes return JSON shaped after these types via /api/resources.

export type {
  Field,
  FieldType,
  ResourceOp,
  Resource,
} from '../worker/resources/types';
