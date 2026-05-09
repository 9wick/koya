import type { ConfigClass } from './types';

type AnyConstructor = new (...args: never[]) => unknown;
type AnyConfigClass = ConfigClass<object>;

// Token (symbol) → 現在登録されている実装クラス
const tokenToClass = new Map<symbol, AnyConfigClass>();

// クラス → そのクラス（または祖先）に紐づくトークン
const classToToken = new WeakMap<AnyConfigClass, symbol>();

const findTokenInChain = (cls: AnyConstructor): symbol | null => {
  let current: AnyConstructor | null = cls;
  while (current && current !== Function.prototype) {
    const token = classToToken.get(current as AnyConfigClass);
    if (token) return token;
    current = Object.getPrototypeOf(current) as AnyConstructor | null;
  }
  return null;
};

export const registerConfigToken = (cls: AnyConstructor): void => {
  const typed = cls as AnyConfigClass;
  if (classToToken.has(typed)) return;

  const parent = Object.getPrototypeOf(cls) as AnyConstructor | null;
  const parentToken = parent ? findTokenInChain(parent) : null;

  if (parentToken) {
    classToToken.set(typed, parentToken);
    tokenToClass.set(parentToken, typed);
  } else {
    const newToken = Symbol(`ConfigToken:${cls.name}`);
    classToToken.set(typed, newToken);
    tokenToClass.set(newToken, typed);
  }
};

export const findConfigToken = (cls: AnyConstructor): AnyConfigClass | null => {
  const token = findTokenInChain(cls);
  if (!token) return null;
  return tokenToClass.get(token) ?? null;
};

export const findRootConfigToken = (cls: AnyConstructor): AnyConfigClass | null => {
  const token = findTokenInChain(cls);
  if (!token) return null;

  let root: AnyConfigClass | null = null;
  let current: AnyConstructor | null = cls;
  while (current && current !== Function.prototype) {
    if (classToToken.get(current as AnyConfigClass) === token) {
      root = current as AnyConfigClass;
    }
    current = Object.getPrototypeOf(current) as AnyConstructor | null;
  }
  return root;
};
