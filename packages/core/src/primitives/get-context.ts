import { getEntryContext } from '../internal/entry-context';

// biome-ignore lint/suspicious/noEmptyInterface: users extend this interface via module augmentation
export interface RequestContextSchema {}

export const getContext = <K extends keyof RequestContextSchema>(
  key: K,
): RequestContextSchema[K] | undefined => {
  const ctx = getEntryContext();
  return ctx.honoContext.get(key) as RequestContextSchema[K] | undefined;
};

export const setContext = <K extends keyof RequestContextSchema>(
  key: K,
  value: RequestContextSchema[K],
): void => {
  const ctx = getEntryContext();
  ctx.honoContext.set(key, value);
};
