# @zelt/decorator-metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a generic package that captures decorator position info at runtime and extracts type information using TypeScript Compiler API at build time.

**Architecture:** Runtime API stores position + custom props in WeakMap when decorators execute. Inspect API uses TypeChecker to extract full type information from stored positions. Program is cached per tsconfig for performance.

**Tech Stack:** TypeScript Compiler API, WeakMap, neverthrow for Result type

---

## File Structure

```
packages/decorator-metadata/
├── src/
│   ├── index.ts                    # Re-export runtime API
│   ├── runtime/
│   │   ├── position.ts             # getCallerPosition() from Error stack
│   │   ├── store.ts                # WeakMap storage for class/method/property metadata
│   │   └── decorators.ts           # createClassDecorator, createMethodDecorator, createPropertyDecorator
│   ├── inspect/
│   │   ├── index.ts                # Re-export inspect API
│   │   ├── types.ts                # TypeInfo, ClassMetadata, InspectError etc.
│   │   ├── resolve-typescript.ts   # Dynamic TS version resolution
│   │   ├── program-cache.ts        # Program/TypeChecker cache per tsconfig
│   │   ├── type-extractor.ts       # Convert ts.Type to TypeInfo
│   │   └── get-type-metadata.ts    # Main API: getTypeMetadata()
│   └── test/
│       ├── fixtures/
│       │   └── sample.controller.ts  # Test fixture with decorators
│       ├── runtime.test.ts           # Runtime API tests
│       └── inspect.test.ts           # Inspect API tests
├── package.json
├── tsconfig.json
├── tsdown.config.ts
└── vitest.config.ts
```

---

## Task 1: Package Scaffold

**Files:**
- Create: `packages/decorator-metadata/package.json`
- Create: `packages/decorator-metadata/tsconfig.json`
- Create: `packages/decorator-metadata/tsdown.config.ts`
- Create: `packages/decorator-metadata/vitest.config.ts`

- [ ] **Step 1: Create package.json**

```bash
mkdir -p packages/decorator-metadata/src
```

Create `packages/decorator-metadata/package.json`:

```json
{
  "name": "@zeltjs/decorator-metadata",
  "version": "0.0.1",
  "type": "module",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/zeltjs/zelt.git",
    "directory": "packages/decorator-metadata"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./inspect": {
      "types": "./dist/inspect/index.d.ts",
      "import": "./dist/inspect/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "neverthrow": "8.2.0"
  },
  "peerDependencies": {
    "typescript": ">=5.0.0"
  },
  "peerDependenciesMeta": {
    "typescript": {
      "optional": true
    }
  },
  "optionalDependencies": {
    "typescript-6": "npm:typescript@~6.0.0"
  },
  "devDependencies": {
    "@types/node": "22.19.17",
    "typescript": "6.0.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/decorator-metadata/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create tsdown.config.ts**

Create `packages/decorator-metadata/tsdown.config.ts`:

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/inspect/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  fixedExtension: false,
});
```

- [ ] **Step 4: Create vitest.config.ts**

Create `packages/decorator-metadata/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
  },
});
```

- [ ] **Step 5: Create placeholder index files**

Create `packages/decorator-metadata/src/index.ts`:

```typescript
export {};
```

Create `packages/decorator-metadata/src/inspect/index.ts`:

```typescript
export {};
```

- [ ] **Step 6: Install dependencies and verify build**

```bash
cd packages/decorator-metadata && pnpm install && pnpm build
```

Expected: Build succeeds with empty dist files.

- [ ] **Step 7: Commit**

```bash
git add packages/decorator-metadata
git commit -m "feat(decorator-metadata): scaffold package structure"
```

---

## Task 2: Position Extraction

**Files:**
- Create: `packages/decorator-metadata/src/runtime/position.ts`
- Create: `packages/decorator-metadata/src/test/runtime.test.ts`

- [ ] **Step 1: Write failing test for getCallerPosition**

Create `packages/decorator-metadata/src/test/runtime.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getCallerPosition } from '../runtime/position';

describe('getCallerPosition', () => {
  it('returns position with sourceFile, line, column', () => {
    const pos = getCallerPosition();
    
    expect(pos).toBeDefined();
    expect(pos?.sourceFile).toContain('runtime.test.ts');
    expect(typeof pos?.line).toBe('number');
    expect(typeof pos?.column).toBe('number');
    expect(pos?.line).toBeGreaterThan(0);
    expect(pos?.column).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/decorator-metadata && pnpm test
```

Expected: FAIL - Cannot find module '../runtime/position'

- [ ] **Step 3: Implement getCallerPosition**

Create `packages/decorator-metadata/src/runtime/position.ts`:

```typescript
export type Position = {
  readonly sourceFile: string;
  readonly line: number;
  readonly column: number;
};

const isFrameworkPath = (path: string): boolean =>
  path.includes('node_modules') ||
  path.includes('packages/decorator-metadata/src/runtime');

const parsePositionFromStackLine = (
  line: string,
): Position | undefined => {
  const parenMatch = line.match(/\(([^)]+):(\d+):(\d+)\)/);
  if (parenMatch) {
    const [, file, lineNum, colNum] = parenMatch;
    if (file && !isFrameworkPath(file)) {
      return {
        sourceFile: file,
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
      };
    }
  }

  const atMatch = line.match(/at\s+([^\s]+):(\d+):(\d+)/);
  if (atMatch) {
    const [, file, lineNum, colNum] = atMatch;
    if (file && !isFrameworkPath(file)) {
      return {
        sourceFile: file,
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
      };
    }
  }

  return undefined;
};

export const getCallerPosition = (): Position | undefined => {
  const stack = new Error().stack;
  if (!stack) return undefined;

  const lines = stack.split('\n');
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const pos = parsePositionFromStackLine(line);
    if (pos) return pos;
  }

  return undefined;
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/decorator-metadata && pnpm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/decorator-metadata/src
git commit -m "feat(decorator-metadata): implement position extraction from Error stack"
```

---

## Task 3: WeakMap Store

**Files:**
- Create: `packages/decorator-metadata/src/runtime/store.ts`
- Modify: `packages/decorator-metadata/src/test/runtime.test.ts`

- [ ] **Step 1: Write failing test for store**

Add to `packages/decorator-metadata/src/test/runtime.test.ts`:

```typescript
import {
  setClassMetadata,
  getClassMetadata,
  setMethodMetadata,
  getMethodMetadata,
  setPropertyMetadata,
  getPropertyMetadata,
} from '../runtime/store';
import type { Position } from '../runtime/position';

describe('metadata store', () => {
  const mockPos: Position = { sourceFile: '/test.ts', line: 10, column: 1 };

  it('stores and retrieves class metadata', () => {
    class TestClass {}
    
    setClassMetadata(TestClass, mockPos, { basePath: '/api' });
    const meta = getClassMetadata(TestClass);
    
    expect(meta).toEqual({
      pos: mockPos,
      props: { basePath: '/api' },
      methods: [],
      properties: [],
    });
  });

  it('stores and retrieves method metadata', () => {
    class TestClass {}
    
    setClassMetadata(TestClass, mockPos, {});
    setMethodMetadata(TestClass, 'getUser', mockPos, { method: 'GET' });
    
    const meta = getClassMetadata(TestClass);
    expect(meta?.methods).toHaveLength(1);
    expect(meta?.methods[0]).toEqual({
      name: 'getUser',
      pos: mockPos,
      props: { method: 'GET' },
    });
  });

  it('stores and retrieves property metadata', () => {
    class TestClass {}
    
    setClassMetadata(TestClass, mockPos, {});
    setPropertyMetadata(TestClass, 'name', mockPos, { nullable: false });
    
    const meta = getClassMetadata(TestClass);
    expect(meta?.properties).toHaveLength(1);
    expect(meta?.properties[0]).toEqual({
      name: 'name',
      pos: mockPos,
      props: { nullable: false },
    });
  });

  it('returns undefined for class without metadata', () => {
    class NoMetaClass {}
    expect(getClassMetadata(NoMetaClass)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/decorator-metadata && pnpm test
```

Expected: FAIL - Cannot find module '../runtime/store'

- [ ] **Step 3: Implement store**

Create `packages/decorator-metadata/src/runtime/store.ts`:

```typescript
import type { Position } from './position';

type MethodMeta = {
  readonly name: string;
  readonly pos: Position;
  readonly props: object;
};

type PropertyMeta = {
  readonly name: string;
  readonly pos: Position;
  readonly props: object;
};

type ClassMeta = {
  readonly pos: Position;
  readonly props: object;
  readonly methods: MethodMeta[];
  readonly properties: PropertyMeta[];
};

const classStore = new WeakMap<object, ClassMeta>();

export const setClassMetadata = (
  cls: object,
  pos: Position,
  props: object,
): void => {
  const existing = classStore.get(cls);
  classStore.set(cls, {
    pos,
    props,
    methods: existing?.methods ?? [],
    properties: existing?.properties ?? [],
  });
};

export const getClassMetadata = (cls: object): ClassMeta | undefined =>
  classStore.get(cls);

export const setMethodMetadata = (
  cls: object,
  name: string,
  pos: Position,
  props: object,
): void => {
  const existing = classStore.get(cls);
  const methods = existing?.methods ?? [];
  const properties = existing?.properties ?? [];
  
  classStore.set(cls, {
    pos: existing?.pos ?? pos,
    props: existing?.props ?? {},
    methods: [...methods, { name, pos, props }],
    properties,
  });
};

export const getMethodMetadata = (
  cls: object,
  name: string,
): MethodMeta | undefined => {
  const meta = classStore.get(cls);
  return meta?.methods.find((m) => m.name === name);
};

export const setPropertyMetadata = (
  cls: object,
  name: string,
  pos: Position,
  props: object,
): void => {
  const existing = classStore.get(cls);
  const methods = existing?.methods ?? [];
  const properties = existing?.properties ?? [];
  
  classStore.set(cls, {
    pos: existing?.pos ?? pos,
    props: existing?.props ?? {},
    methods,
    properties: [...properties, { name, pos, props }],
  });
};

export const getPropertyMetadata = (
  cls: object,
  name: string,
): PropertyMeta | undefined => {
  const meta = classStore.get(cls);
  return meta?.properties.find((p) => p.name === name);
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/decorator-metadata && pnpm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/decorator-metadata/src
git commit -m "feat(decorator-metadata): implement WeakMap metadata store"
```

---

## Task 4: Decorator Factories

**Files:**
- Create: `packages/decorator-metadata/src/runtime/decorators.ts`
- Modify: `packages/decorator-metadata/src/test/runtime.test.ts`
- Modify: `packages/decorator-metadata/src/index.ts`

- [ ] **Step 1: Write failing test for decorator factories**

Add to `packages/decorator-metadata/src/test/runtime.test.ts`:

```typescript
import {
  createClassDecorator,
  createMethodDecorator,
  createPropertyDecorator,
} from '../runtime/decorators';

describe('decorator factories', () => {
  it('createClassDecorator stores metadata on class', () => {
    const Controller = (basePath: string) =>
      createClassDecorator({ basePath });

    @Controller('/users')
    class UserController {}

    const meta = getClassMetadata(UserController);
    expect(meta).toBeDefined();
    expect(meta?.props).toEqual({ basePath: '/users' });
    expect(meta?.pos.sourceFile).toContain('runtime.test.ts');
  });

  it('createMethodDecorator stores metadata on method', () => {
    const Controller = () => createClassDecorator({});
    const Get = (path: string) => createMethodDecorator({ method: 'GET', path });

    @Controller()
    class TestController {
      @Get('/items')
      getItems() {}
    }

    const meta = getClassMetadata(TestController);
    expect(meta?.methods).toHaveLength(1);
    expect(meta?.methods[0]?.props).toEqual({ method: 'GET', path: '/items' });
  });

  it('createPropertyDecorator stores metadata on property', () => {
    const Entity = () => createClassDecorator({});
    const Column = (opts?: { nullable?: boolean }) =>
      createPropertyDecorator({ nullable: opts?.nullable ?? false });

    @Entity()
    class User {
      @Column()
      name!: string;

      @Column({ nullable: true })
      email?: string;
    }

    const meta = getClassMetadata(User);
    expect(meta?.properties).toHaveLength(2);
    expect(meta?.properties[0]?.props).toEqual({ nullable: false });
    expect(meta?.properties[1]?.props).toEqual({ nullable: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/decorator-metadata && pnpm test
```

Expected: FAIL - Cannot find module '../runtime/decorators'

- [ ] **Step 3: Implement decorator factories**

Create `packages/decorator-metadata/src/runtime/decorators.ts`:

```typescript
import { getCallerPosition } from './position';
import {
  setClassMetadata,
  setMethodMetadata,
  setPropertyMetadata,
} from './store';

export const createClassDecorator = <TProps extends object>(
  props?: TProps,
): ClassDecorator => {
  const pos = getCallerPosition();
  
  return (target: Function): void => {
    if (pos) {
      setClassMetadata(target, pos, props ?? {});
    }
  };
};

export const createMethodDecorator = <TProps extends object>(
  props?: TProps,
): MethodDecorator => {
  const pos = getCallerPosition();
  
  return (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor,
  ): void => {
    if (pos && typeof propertyKey === 'string') {
      const cls = target.constructor;
      setMethodMetadata(cls, propertyKey, pos, props ?? {});
    }
  };
};

export const createPropertyDecorator = <TProps extends object>(
  props?: TProps,
): PropertyDecorator => {
  const pos = getCallerPosition();
  
  return (target: object, propertyKey: string | symbol): void => {
    if (pos && typeof propertyKey === 'string') {
      const cls = target.constructor;
      setPropertyMetadata(cls, propertyKey, pos, props ?? {});
    }
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/decorator-metadata && pnpm test
```

Expected: PASS

- [ ] **Step 5: Export from index.ts**

Update `packages/decorator-metadata/src/index.ts`:

```typescript
export type { Position } from './runtime/position';
export {
  createClassDecorator,
  createMethodDecorator,
  createPropertyDecorator,
} from './runtime/decorators';
export { getClassMetadata } from './runtime/store';
```

- [ ] **Step 6: Run build and typecheck**

```bash
cd packages/decorator-metadata && pnpm build && pnpm typecheck
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/decorator-metadata/src
git commit -m "feat(decorator-metadata): implement decorator factories"
```

---

## Task 5: Inspect Types

**Files:**
- Create: `packages/decorator-metadata/src/inspect/types.ts`

- [ ] **Step 1: Create type definitions**

Create `packages/decorator-metadata/src/inspect/types.ts`:

```typescript
import type { Position } from '../runtime/position';

export type { Position };

export type PrimitiveType = 'string' | 'number' | 'boolean' | 'null' | 'undefined';

export type TypeInfo =
  | { readonly kind: 'primitive'; readonly type: PrimitiveType }
  | { readonly kind: 'literal'; readonly value: string | number | boolean }
  | { readonly kind: 'named'; readonly name: string; readonly module: string; readonly isExported: boolean }
  | { readonly kind: 'array'; readonly items: TypeInfo }
  | { readonly kind: 'object'; readonly properties: readonly TypedPropertyInfo[] }
  | { readonly kind: 'union'; readonly types: readonly TypeInfo[] }
  | { readonly kind: 'promise'; readonly inner: TypeInfo }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'ref'; readonly name: string };

export type TypedPropertyInfo = {
  readonly name: string;
  readonly type: TypeInfo;
  readonly optional: boolean;
};

export type ParamInfo = {
  readonly name: string;
  readonly type: TypeInfo;
};

export type MethodInfo<TProps = unknown> = {
  readonly name: string;
  readonly pos: Position;
  readonly props: TProps;
  readonly params: readonly ParamInfo[];
  readonly returnType: TypeInfo;
};

export type PropertyInfo<TProps = unknown> = {
  readonly name: string;
  readonly pos: Position;
  readonly props: TProps;
  readonly type: TypeInfo;
  readonly optional: boolean;
};

export type ClassMetadata<
  TClassProps = unknown,
  TMethodProps = unknown,
  TPropertyProps = unknown,
> = {
  readonly name: string;
  readonly pos: Position;
  readonly props: TClassProps;
  readonly methods: readonly MethodInfo<TMethodProps>[];
  readonly properties: readonly PropertyInfo<TPropertyProps>[];
};

export type InspectErrorCode =
  | 'NO_METADATA'
  | 'SOURCE_NOT_FOUND'
  | 'POSITION_INVALID'
  | 'TSCONFIG_ERROR';

export type InspectError = {
  readonly code: InspectErrorCode;
  readonly message: string;
};

export type ExpandStrategy = 'exported-only' | 'all-named' | 'always';

export type InspectOptions = {
  readonly tsconfig?: string;
  readonly expandStrategy?: ExpandStrategy;
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/decorator-metadata && pnpm build
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/decorator-metadata/src
git commit -m "feat(decorator-metadata): add inspect type definitions"
```

---

## Task 6: TypeScript Version Resolution

**Files:**
- Create: `packages/decorator-metadata/src/inspect/resolve-typescript.ts`

- [ ] **Step 1: Implement resolve-typescript**

Create `packages/decorator-metadata/src/inspect/resolve-typescript.ts`:

```typescript
type TypeScriptModule = typeof import('typescript');

let cachedTs: TypeScriptModule | undefined;

export const resolveTypeScript = async (): Promise<TypeScriptModule> => {
  if (cachedTs) return cachedTs;

  const userTs: TypeScriptModule = await import('typescript');
  const major = parseInt(userTs.version.split('.')[0], 10);

  if (major >= 7) {
    try {
      cachedTs = await import('typescript-6' as string) as TypeScriptModule;
    } catch {
      throw new Error(
        `TypeScript ${userTs.version} detected but bundled TypeScript 6 not available. ` +
        `Install typescript-6 as optional dependency.`
      );
    }
  } else {
    cachedTs = userTs;
  }

  return cachedTs;
};

export const getTypeScriptVersion = async (): Promise<string> => {
  const ts = await resolveTypeScript();
  return ts.version;
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/decorator-metadata && pnpm build
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/decorator-metadata/src
git commit -m "feat(decorator-metadata): implement TypeScript version resolution"
```

---

## Task 7: Program Cache

**Files:**
- Create: `packages/decorator-metadata/src/inspect/program-cache.ts`

- [ ] **Step 1: Implement program cache**

Create `packages/decorator-metadata/src/inspect/program-cache.ts`:

```typescript
import { resolveTypeScript } from './resolve-typescript';

type TypeScriptModule = typeof import('typescript');

type CachedProgram = {
  readonly program: import('typescript').Program;
  readonly checker: import('typescript').TypeChecker;
  readonly ts: TypeScriptModule;
};

const cache = new Map<string, CachedProgram>();

export const getOrCreateProgram = async (
  tsconfigPath: string,
): Promise<CachedProgram> => {
  const cached = cache.get(tsconfigPath);
  if (cached) return cached;

  const ts = await resolveTypeScript();
  
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(`Failed to read tsconfig: ${tsconfigPath}`);
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    tsconfigPath.replace(/[^/\\]+$/, ''),
  );

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });

  const checker = program.getTypeChecker();
  const result: CachedProgram = { program, checker, ts };
  
  cache.set(tsconfigPath, result);
  return result;
};

export const clearProgramCache = (tsconfigPath?: string): void => {
  if (tsconfigPath) {
    cache.delete(tsconfigPath);
  } else {
    cache.clear();
  }
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/decorator-metadata && pnpm build
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/decorator-metadata/src
git commit -m "feat(decorator-metadata): implement Program cache"
```

---

## Task 8: Type Extractor

**Files:**
- Create: `packages/decorator-metadata/src/inspect/type-extractor.ts`

- [ ] **Step 1: Implement type extractor**

Create `packages/decorator-metadata/src/inspect/type-extractor.ts`:

```typescript
import type {
  TypeInfo,
  TypedPropertyInfo,
  ExpandStrategy,
} from './types';

type ts = typeof import('typescript');

const MAX_DEPTH = 10;

export const createTypeExtractor = (
  tsModule: ts,
  checker: import('typescript').TypeChecker,
  expandStrategy: ExpandStrategy,
) => {
  const extractType = (
    type: import('typescript').Type,
    depth: number = 0,
  ): TypeInfo => {
    if (depth > MAX_DEPTH) {
      return { kind: 'unknown' };
    }

    const flags = type.getFlags();

    if (flags & tsModule.TypeFlags.String) {
      return { kind: 'primitive', type: 'string' };
    }
    if (flags & tsModule.TypeFlags.Number) {
      return { kind: 'primitive', type: 'number' };
    }
    if (flags & tsModule.TypeFlags.Boolean) {
      return { kind: 'primitive', type: 'boolean' };
    }
    if (flags & tsModule.TypeFlags.Null) {
      return { kind: 'primitive', type: 'null' };
    }
    if (flags & tsModule.TypeFlags.Undefined) {
      return { kind: 'primitive', type: 'undefined' };
    }

    if (type.isStringLiteral()) {
      return { kind: 'literal', value: type.value };
    }
    if (type.isNumberLiteral()) {
      return { kind: 'literal', value: type.value };
    }
    if (flags & tsModule.TypeFlags.BooleanLiteral) {
      const intrinsicName = (type as unknown as { intrinsicName?: string }).intrinsicName;
      return { kind: 'literal', value: intrinsicName === 'true' };
    }

    if (type.isUnion()) {
      return {
        kind: 'union',
        types: type.types.map((t) => extractType(t, depth + 1)),
      };
    }

    if (checker.isArrayType(type)) {
      const typeRef = type as import('typescript').TypeReference;
      const elemType = typeRef.typeArguments?.[0];
      return {
        kind: 'array',
        items: elemType ? extractType(elemType, depth + 1) : { kind: 'unknown' },
      };
    }

    const typeStr = checker.typeToString(type);
    if (typeStr.startsWith('Promise<')) {
      const typeRef = type as import('typescript').TypeReference;
      const innerType = typeRef.typeArguments?.[0];
      return {
        kind: 'promise',
        inner: innerType ? extractType(innerType, depth + 1) : { kind: 'unknown' },
      };
    }

    const aliasSymbol = type.aliasSymbol;
    if (aliasSymbol && shouldKeepAsRef(aliasSymbol, expandStrategy)) {
      const decl = aliasSymbol.declarations?.[0];
      const sourceFile = decl?.getSourceFile();
      return {
        kind: 'named',
        name: aliasSymbol.getName(),
        module: sourceFile?.fileName ?? '',
        isExported: isExported(decl, tsModule),
      };
    }

    const props = type.getProperties();
    if (props.length > 0) {
      const properties: TypedPropertyInfo[] = props.map((prop) => {
        const propType = checker.getTypeOfSymbol(prop);
        const isOptional = (prop.flags & tsModule.SymbolFlags.Optional) !== 0;
        return {
          name: prop.getName(),
          type: extractType(propType, depth + 1),
          optional: isOptional,
        };
      });
      return { kind: 'object', properties };
    }

    return { kind: 'unknown' };
  };

  const shouldKeepAsRef = (
    symbol: import('typescript').Symbol,
    strategy: ExpandStrategy,
  ): boolean => {
    if (strategy === 'always') return false;

    const decl = symbol.declarations?.[0];
    if (!decl) return false;

    if (strategy === 'exported-only') {
      return isExported(decl, tsModule);
    }

    return true;
  };

  const isExported = (
    decl: import('typescript').Declaration | undefined,
    ts: ts,
  ): boolean => {
    if (!decl) return false;
    const modifiers = ts.canHaveModifiers(decl) ? ts.getModifiers(decl) : undefined;
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  };

  return { extractType };
};
```

- [ ] **Step 2: Verify build**

```bash
cd packages/decorator-metadata && pnpm build
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/decorator-metadata/src
git commit -m "feat(decorator-metadata): implement type extractor"
```

---

## Task 9: getTypeMetadata API

**Files:**
- Create: `packages/decorator-metadata/src/inspect/get-type-metadata.ts`
- Modify: `packages/decorator-metadata/src/inspect/index.ts`

- [ ] **Step 1: Implement getTypeMetadata**

Create `packages/decorator-metadata/src/inspect/get-type-metadata.ts`:

```typescript
import { err, ok, type Result } from 'neverthrow';
import { resolve } from 'node:path';

import { getClassMetadata } from '../runtime/store';
import { getOrCreateProgram } from './program-cache';
import { createTypeExtractor } from './type-extractor';
import type {
  ClassMetadata,
  InspectError,
  InspectOptions,
  MethodInfo,
  PropertyInfo,
  ParamInfo,
} from './types';

const DEFAULT_TSCONFIG = './tsconfig.json';
const DEFAULT_EXPAND_STRATEGY = 'exported-only' as const;

export const getTypeMetadata = async <T extends object>(
  cls: new (...args: unknown[]) => T,
  options?: InspectOptions,
): Promise<Result<ClassMetadata, InspectError>> => {
  const storedMeta = getClassMetadata(cls);
  if (!storedMeta) {
    return err({
      code: 'NO_METADATA',
      message: `No decorator metadata found for class ${cls.name}`,
    });
  }

  const tsconfigPath = resolve(options?.tsconfig ?? DEFAULT_TSCONFIG);
  const expandStrategy = options?.expandStrategy ?? DEFAULT_EXPAND_STRATEGY;

  let cached;
  try {
    cached = await getOrCreateProgram(tsconfigPath);
  } catch (e) {
    return err({
      code: 'TSCONFIG_ERROR',
      message: `Failed to load tsconfig: ${tsconfigPath}`,
    });
  }

  const { program, checker, ts } = cached;
  const { extractType } = createTypeExtractor(ts, checker, expandStrategy);

  const sourceFile = program.getSourceFile(storedMeta.pos.sourceFile);
  if (!sourceFile) {
    return err({
      code: 'SOURCE_NOT_FOUND',
      message: `Source file not found: ${storedMeta.pos.sourceFile}`,
    });
  }

  const pos = ts.getPositionOfLineAndCharacter(
    sourceFile,
    storedMeta.pos.line - 1,
    storedMeta.pos.column - 1,
  );

  const classNode = findClassAtPosition(sourceFile, pos, ts);
  if (!classNode || !ts.isClassDeclaration(classNode)) {
    return err({
      code: 'POSITION_INVALID',
      message: `No class found at position ${storedMeta.pos.line}:${storedMeta.pos.column}`,
    });
  }

  const methods: MethodInfo[] = storedMeta.methods.map((m) => {
    const methodNode = findMethodInClass(classNode, m.name, ts);
    const params: ParamInfo[] = [];
    let returnType = { kind: 'unknown' } as const;

    if (methodNode) {
      const sig = checker.getSignatureFromDeclaration(methodNode);
      if (sig) {
        for (const param of sig.getParameters()) {
          const paramType = checker.getTypeOfSymbol(param);
          params.push({
            name: param.getName(),
            type: extractType(paramType),
          });
        }

        let retType = sig.getReturnType();
        const retTypeStr = checker.typeToString(retType);
        if (retTypeStr.startsWith('Promise<')) {
          const typeRef = retType as import('typescript').TypeReference;
          retType = typeRef.typeArguments?.[0] ?? retType;
        }
        returnType = extractType(retType);
      }
    }

    return {
      name: m.name,
      pos: m.pos,
      props: m.props,
      params,
      returnType,
    };
  });

  const properties: PropertyInfo[] = storedMeta.properties.map((p) => {
    const propNode = findPropertyInClass(classNode, p.name, ts);
    let type = { kind: 'unknown' } as const;
    let optional = false;

    if (propNode) {
      const propSymbol = checker.getSymbolAtLocation(propNode.name);
      if (propSymbol) {
        const propType = checker.getTypeOfSymbol(propSymbol);
        type = extractType(propType);
        optional = (propSymbol.flags & ts.SymbolFlags.Optional) !== 0;
      }
    }

    return {
      name: p.name,
      pos: p.pos,
      props: p.props,
      type,
      optional,
    };
  });

  return ok({
    name: cls.name,
    pos: storedMeta.pos,
    props: storedMeta.props,
    methods,
    properties,
  });
};

const findClassAtPosition = (
  sourceFile: import('typescript').SourceFile,
  pos: number,
  ts: typeof import('typescript'),
): import('typescript').ClassDeclaration | undefined => {
  const find = (node: import('typescript').Node): import('typescript').ClassDeclaration | undefined => {
    if (ts.isClassDeclaration(node) && node.pos <= pos && pos < node.end) {
      return node;
    }
    return ts.forEachChild(node, find);
  };
  return find(sourceFile);
};

const findMethodInClass = (
  cls: import('typescript').ClassDeclaration,
  name: string,
  ts: typeof import('typescript'),
): import('typescript').MethodDeclaration | undefined => {
  for (const member of cls.members) {
    if (ts.isMethodDeclaration(member) && member.name?.getText() === name) {
      return member;
    }
  }
  return undefined;
};

const findPropertyInClass = (
  cls: import('typescript').ClassDeclaration,
  name: string,
  ts: typeof import('typescript'),
): import('typescript').PropertyDeclaration | undefined => {
  for (const member of cls.members) {
    if (ts.isPropertyDeclaration(member) && member.name?.getText() === name) {
      return member;
    }
  }
  return undefined;
};
```

- [ ] **Step 2: Export from inspect/index.ts**

Update `packages/decorator-metadata/src/inspect/index.ts`:

```typescript
export type {
  Position,
  TypeInfo,
  TypedPropertyInfo,
  ParamInfo,
  MethodInfo,
  PropertyInfo,
  ClassMetadata,
  InspectError,
  InspectErrorCode,
  InspectOptions,
  ExpandStrategy,
} from './types';

export { getTypeMetadata } from './get-type-metadata';
export { clearProgramCache } from './program-cache';
```

- [ ] **Step 3: Verify build**

```bash
cd packages/decorator-metadata && pnpm build
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/decorator-metadata/src
git commit -m "feat(decorator-metadata): implement getTypeMetadata API"
```

---

## Task 10: Integration Test

**Files:**
- Create: `packages/decorator-metadata/src/test/fixtures/sample.controller.ts`
- Create: `packages/decorator-metadata/src/test/inspect.test.ts`

- [ ] **Step 1: Create test fixture**

Create `packages/decorator-metadata/src/test/fixtures/sample.controller.ts`:

```typescript
import {
  createClassDecorator,
  createMethodDecorator,
  createPropertyDecorator,
} from '../../index';

export type UserId = string;

export type User = {
  id: UserId;
  name: string;
  email?: string;
};

type InternalRole = 'admin' | 'user';

const Controller = (basePath: string) => createClassDecorator({ basePath });
const Get = (path: string) => createMethodDecorator({ method: 'GET', path });
const Post = (path: string) => createMethodDecorator({ method: 'POST', path });
const Column = (opts?: { nullable?: boolean }) =>
  createPropertyDecorator({ nullable: opts?.nullable ?? false });

@Controller('/users')
export class UserController {
  @Get('/:id')
  getUser(id: UserId): Promise<User | null> {
    return Promise.resolve(null);
  }

  @Post('/')
  createUser(data: Pick<User, 'name' | 'email'>): User {
    return { id: '1', name: data.name, email: data.email };
  }
}

@Controller('/entities')
export class Entity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;
}
```

- [ ] **Step 2: Write integration test**

Create `packages/decorator-metadata/src/test/inspect.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';

import { getTypeMetadata, clearProgramCache } from '../inspect/index';

describe('getTypeMetadata', () => {
  beforeAll(() => {
    clearProgramCache();
  });

  it('extracts class metadata with methods', async () => {
    const { UserController } = await import('./fixtures/sample.controller');
    
    const result = await getTypeMetadata(UserController, {
      tsconfig: resolve(__dirname, '../../tsconfig.json'),
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const meta = result.value;
    expect(meta.name).toBe('UserController');
    expect(meta.props).toEqual({ basePath: '/users' });
    expect(meta.methods).toHaveLength(2);

    const getUser = meta.methods.find((m) => m.name === 'getUser');
    expect(getUser).toBeDefined();
    expect(getUser?.props).toEqual({ method: 'GET', path: '/:id' });
    expect(getUser?.params).toHaveLength(1);
    expect(getUser?.params[0]?.name).toBe('id');

    expect(getUser?.returnType.kind).toBe('union');
  });

  it('extracts property metadata', async () => {
    const { Entity } = await import('./fixtures/sample.controller');
    
    const result = await getTypeMetadata(Entity, {
      tsconfig: resolve(__dirname, '../../tsconfig.json'),
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const meta = result.value;
    expect(meta.properties).toHaveLength(2);

    const nameProp = meta.properties.find((p) => p.name === 'name');
    expect(nameProp?.props).toEqual({ nullable: false });
    expect(nameProp?.type.kind).toBe('primitive');

    const descProp = meta.properties.find((p) => p.name === 'description');
    expect(descProp?.props).toEqual({ nullable: true });
    expect(descProp?.optional).toBe(true);
  });

  it('returns error for class without metadata', async () => {
    class NoMetadata {}

    const result = await getTypeMetadata(NoMetadata, {
      tsconfig: resolve(__dirname, '../../tsconfig.json'),
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('NO_METADATA');
    }
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd packages/decorator-metadata && pnpm test
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/decorator-metadata/src
git commit -m "test(decorator-metadata): add integration tests for getTypeMetadata"
```

---

## Task 11: Final Cleanup and Documentation

**Files:**
- Modify: `packages/decorator-metadata/package.json`
- Create: `packages/decorator-metadata/README.md`

- [ ] **Step 1: Update package.json description**

Update `packages/decorator-metadata/package.json` to add description:

```json
{
  "name": "@zeltjs/decorator-metadata",
  "version": "0.0.1",
  "description": "Runtime decorator metadata capture and TypeScript type extraction",
  ...
}
```

- [ ] **Step 2: Create README.md**

Create `packages/decorator-metadata/README.md`:

```markdown
# @zeltjs/decorator-metadata

Runtime decorator metadata capture and TypeScript type extraction for TC39 decorators.

## Installation

```bash
pnpm add @zeltjs/decorator-metadata
```

## Usage

### Runtime API

```typescript
import {
  createClassDecorator,
  createMethodDecorator,
  createPropertyDecorator,
} from '@zeltjs/decorator-metadata';

// Create custom decorators
const Controller = (basePath: string) =>
  createClassDecorator({ basePath });

const Get = (path: string) =>
  createMethodDecorator({ method: 'GET', path });

// Use decorators
@Controller('/users')
class UserController {
  @Get('/:id')
  getUser(id: string): User {
    // ...
  }
}
```

### Inspect API

```typescript
import { getTypeMetadata } from '@zeltjs/decorator-metadata/inspect';

const result = await getTypeMetadata(UserController, {
  tsconfig: './tsconfig.json',
  expandStrategy: 'exported-only',
});

if (result.isOk()) {
  console.log(result.value);
  // {
  //   name: 'UserController',
  //   props: { basePath: '/users' },
  //   methods: [{ name: 'getUser', params: [...], returnType: {...} }],
  //   properties: []
  // }
}
```

## License

MIT
```

- [ ] **Step 3: Run full build and test**

```bash
cd packages/decorator-metadata && pnpm build && pnpm typecheck && pnpm test
```

Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add packages/decorator-metadata
git commit -m "docs(decorator-metadata): add README and package description"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All sections covered - runtime API, inspect API, Program cache, TS version resolution, error handling
- [x] **Placeholder scan:** No TBD/TODO found
- [x] **Type consistency:** Types match across tasks (Position, TypeInfo, ClassMetadata, etc.)
