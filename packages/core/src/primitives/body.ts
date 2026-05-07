import { getEntryContext } from '../internal/entry-context';

type BodyType = 'text' | 'json' | 'form' | 'arrayBuffer' | 'blob';
type BodyResult = Promise<string | unknown | FormData | ArrayBuffer | Blob>;

export function body(type: 'text'): Promise<string>;
export function body(type: 'json'): Promise<unknown>;
export function body(type: 'form'): Promise<FormData>;
export function body(type: 'arrayBuffer'): Promise<ArrayBuffer>;
export function body(type: 'blob'): Promise<Blob>;
export function body(type: BodyType): BodyResult {
  const req = getEntryContext().honoContext.req;
  if (type === 'text') return req.text();
  if (type === 'json') return req.json();
  if (type === 'form') return req.formData();
  if (type === 'arrayBuffer') return req.arrayBuffer();
  return req.blob();
}
