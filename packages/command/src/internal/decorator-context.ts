import { match, P } from 'ts-pattern';

export type InjectableClass = new (...args: never[]) => object;

export type ClassDecoratorArgs = {
  readonly cls: object;
  readonly injectableClass: InjectableClass;
};

const isObjectOrFunction = (v: unknown): boolean =>
  (typeof v === 'object' && v !== null) || typeof v === 'function';

const tc39ClassPattern = P.shape({
  kind: 'class',
  metadata: P.nonNullable,
});

const emptyClass: InjectableClass = class {};
const emptyObject: object = {};

const toInjectableClass = (cls: object): InjectableClass => {
  if (typeof cls !== 'function') return emptyClass;
  return cls as InjectableClass;
};

export const resolveClassArgs = (args: unknown[]): ClassDecoratorArgs => {
  const [target, context] = args;

  return match(context)
    .with(tc39ClassPattern, () => {
      const cls: object = isObjectOrFunction(target) ? (target as object) : emptyObject;
      return { cls, injectableClass: toInjectableClass(cls) };
    })
    .otherwise(() => {
      const targetObj: object = isObjectOrFunction(target) ? (target as object) : emptyObject;
      return {
        cls: targetObj,
        injectableClass: toInjectableClass(targetObj),
      };
    });
};
