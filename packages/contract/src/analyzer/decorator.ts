// packages/contract/src/analyzer/decorator.ts
import { type ClassDeclaration, type MethodDeclaration, type Node, SyntaxKind } from 'ts-morph';
import { ok, err, type Result } from 'neverthrow';

import type { AnalyzerError } from '../errors';

const HTTP_METHOD_MAP = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
} as const;

type HttpMethod = (typeof HTTP_METHOD_MAP)[keyof typeof HTTP_METHOD_MAP];

type ControllerDecoratorInfo = {
  readonly basePath: string;
};

export type RouteDecoratorInfo = {
  readonly method: HttpMethod;
  readonly path: string;
};

const lookupHttpMethod = (name: string): HttpMethod | undefined => {
  const entries: ReadonlyArray<[string, HttpMethod]> = Object.entries(HTTP_METHOD_MAP);
  for (const [key, value] of entries) {
    if (key === name) return value;
  }
  return undefined;
};

const stringLiteralArg = (
  decoratorName: string,
  args: readonly Node[],
): Result<string, AnalyzerError> => {
  const first = args[0];
  if (!first || first.getKind() !== SyntaxKind.StringLiteral) {
    return err({ type: 'DECORATOR_REQUIRES_STRING_LITERAL', decoratorName });
  }
  const text = first.getText();
  return ok(text.slice(1, -1));
};

export const extractControllerDecorator = (
  cls: ClassDeclaration,
): Result<ControllerDecoratorInfo, AnalyzerError> | undefined => {
  const dec = cls.getDecorator('Controller');
  if (!dec) return undefined;
  return stringLiteralArg('Controller', dec.getArguments()).map((basePath) => ({ basePath }));
};

export const extractRouteDecorator = (
  m: MethodDeclaration,
): Result<RouteDecoratorInfo, AnalyzerError> | undefined => {
  for (const dec of m.getDecorators()) {
    const name = dec.getName();
    const method = lookupHttpMethod(name);
    if (method !== undefined) {
      return stringLiteralArg(name, dec.getArguments()).map((path) => ({ method, path }));
    }
  }
  return undefined;
};
