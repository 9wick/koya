import { getEntryContext } from '../internal/entry-context';

// biome-ignore lint/suspicious/noEmptyInterface: users extend this interface via module augmentation
export interface KoyaContextSchema {}

export const getContext = <K extends keyof KoyaContextSchema>(
  key: K,
): KoyaContextSchema[K] | undefined => {
  const ctx = getEntryContext();
  return ctx.honoContext.get(key) as KoyaContextSchema[K] | undefined;
};

export const setContext = <K extends keyof KoyaContextSchema>(
  key: K,
  value: KoyaContextSchema[K],
): void => {
  const ctx = getEntryContext();
  ctx.honoContext.set(key, value);
};
