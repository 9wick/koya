type AnyClass = new (...args: never[]) => unknown;

const transientClasses = new WeakSet<AnyClass>();

export const registerAsTransient = (cls: AnyClass): void => {
  transientClasses.add(cls);
};

export const isTransientClass = (cls: AnyClass): boolean => transientClasses.has(cls);
