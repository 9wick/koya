import type { Position } from './position';
import { getCallerPosition } from './position';
import { setClassMetadata, setMethodMetadata, setPropertyMetadata } from './store';

type PendingEntry = { name: string; pos: Position; props: object };

// Keyed on context.metadata (shared object across all decorators of a class)
// to accumulate method/field metadata before the class decorator runs.
const pendingMethods = new WeakMap<object, PendingEntry[]>();
const pendingFields = new WeakMap<object, PendingEntry[]>();

const appendEntry = (
  store: WeakMap<object, PendingEntry[]>,
  meta: object,
  entry: PendingEntry,
): void => {
  const list = store.get(meta) ?? [];
  store.set(meta, [...list, entry]);
};

const flushPendingToClass = (cls: object, sharedMeta: DecoratorMetadataObject): void => {
  for (const { name, pos, props } of pendingMethods.get(sharedMeta) ?? []) {
    setMethodMetadata(cls, name, pos, props);
  }
  for (const { name, pos, props } of pendingFields.get(sharedMeta) ?? []) {
    setPropertyMetadata(cls, name, pos, props);
  }
  pendingMethods.delete(sharedMeta);
  pendingFields.delete(sharedMeta);
};

export const createClassDecorator = <TProps extends object>(
  props?: TProps,
): ((
  value: abstract new (...args: never[]) => unknown,
  context: ClassDecoratorContext,
) => void) => {
  const pos = getCallerPosition();
  const resolvedProps: object = props ?? {};

  return (value, context): void => {
    if (!pos) return;
    const meta = context.metadata;
    setClassMetadata(value, pos, resolvedProps);
    if (meta) flushPendingToClass(value, meta);
  };
};

export const createMethodDecorator = <TProps extends object>(
  props?: TProps,
): ((value: (...args: never[]) => unknown, context: ClassMethodDecoratorContext) => void) => {
  const pos = getCallerPosition();
  const resolvedProps: object = props ?? {};

  return (_value, context): void => {
    if (!pos) return;
    const { name, metadata } = context;
    if (typeof name !== 'string') return;
    if (!metadata) return;
    // TC39: method decorators run before the class decorator.
    // Store pending; class decorator will flush to the class store.
    appendEntry(pendingMethods, metadata, { name, pos, props: resolvedProps });
  };
};

export const createPropertyDecorator = <TProps extends object>(
  props?: TProps,
): ((value: undefined, context: ClassFieldDecoratorContext) => void) => {
  const pos = getCallerPosition();
  const resolvedProps: object = props ?? {};

  return (_value, context): void => {
    if (!pos) return;
    const { name, metadata } = context;
    if (typeof name !== 'string') return;
    if (!metadata) return;
    // TC39: field decorators run before the class decorator.
    // Store pending; class decorator will flush to the class store.
    appendEntry(pendingFields, metadata, { name, pos, props: resolvedProps });
  };
};
