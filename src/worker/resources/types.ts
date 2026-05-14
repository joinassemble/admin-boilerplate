export type FieldType =
  | 'string'
  | 'text'
  | 'email'
  | 'url'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'unix-ts'
  | 'enum'
  | 'json'
  | 'image-url'
  | 'currency';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  primary?: boolean;
  tableColumn?: boolean;
  searchable?: boolean;
  editable?: boolean;
  readOnly?: boolean;
  required?: boolean;
  monospace?: boolean;
  collapsible?: boolean;
  format?: string;
  enumOptions?: Array<{ value: string; label: string }>;
}

export interface ResourceOp {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  /** For list operations: JSON dot-path to the array within the response. */
  dataPath?: string;
  /** For list operations: query param name for cursor-based pagination. */
  cursorParam?: string;
  /** Whether this operation is enabled. Mutations default to false. */
  enabled?: boolean;
}

export interface Resource {
  id: string;
  connection: string;
  name: string;
  group?: string;
  list: ResourceOp;
  detail: ResourceOp;
  create?: ResourceOp;
  update?: ResourceOp;
  delete?: ResourceOp;
  fields: Field[];
}
