# @zeltjs/drizzle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a separate repository `zeltjs/drizzle` with `@zeltjs/drizzle` package that integrates Drizzle ORM with zeltjs framework.

**Architecture:** Injectable `DrizzleService` class that wraps Drizzle ORM instance, reads configuration via `@Config` decorator pattern, and implements `Disposable` interface for lifecycle management. PostgreSQL only (v0.1.0). Uses drizzle-orm types directly (no custom type definitions).

**Tech Stack:** TypeScript, ESM, pnpm, Drizzle ORM, Vitest, tsdown

---

## File Structure

```
zeltjs/drizzle/                    # New repository
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── vitest.config.ts
├── pnpm-lock.yaml
├── .gitignore
├── README.md
└── src/
    ├── index.ts                   # Public exports
    ├── service.ts                 # DrizzleService class
    └── service.test.ts            # Service tests (colocated)
```

---

### Task 1: Create Repository and Initialize Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsdown.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create GitHub repository**

```bash
gh repo create zeltjs/drizzle --public --description "Drizzle ORM integration for zeltjs" --clone
cd drizzle
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@zeltjs/drizzle",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/zeltjs/drizzle.git"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
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
  "peerDependencies": {
    "@zeltjs/core": "^0.1.0",
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "@needle-di/core": "1.1.2",
    "@types/node": "22.19.17",
    "@zeltjs/core": "0.1.1",
    "drizzle-orm": "0.44.3",
    "postgres": "3.4.7",
    "tsdown": "0.12.9",
    "typescript": "5.8.3",
    "vitest": "3.2.2"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": false
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 4: Create tsdown.config.ts**

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['@zeltjs/core', 'drizzle-orm', 'postgres'],
});
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 7: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 8: Commit initial setup**

```bash
git add -A
git commit -m "chore: initialize @zeltjs/drizzle package"
```

---

### Task 2: Implement DrizzleService

**Files:**
- Create: `src/service.ts`
- Create: `src/service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/service.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { DrizzleService } from './service';

vi.mock('postgres', () => ({
  default: vi.fn(() => ({
    end: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({ query: {} })),
}));

const mockEnvService = {
  getString: vi.fn(),
};

vi.mock('@zeltjs/core/modules/env', () => ({
  EnvService: vi.fn(() => mockEnvService),
}));

describe('DrizzleService', () => {
  beforeEach(() => {
    mockEnvService.getString.mockReturnValue('postgres://localhost:5432/test');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should expose db instance', () => {
    const service = new DrizzleService(mockEnvService as any);
    expect(service.db).toBeDefined();
  });

  it('should read DATABASE_URL from EnvService', () => {
    new DrizzleService(mockEnvService as any);
    expect(mockEnvService.getString).toHaveBeenCalledWith('DATABASE_URL', undefined);
  });

  it('should implement Disposable interface', () => {
    const service = new DrizzleService(mockEnvService as any);
    expect(typeof service.shutdown).toBe('function');
  });

  it('should close connection on shutdown', async () => {
    const service = new DrizzleService(mockEnvService as any);
    await expect(service.shutdown()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL with "Cannot find module './service'"

- [ ] **Step 3: Write minimal implementation**

Create `src/service.ts`:

```typescript
import { Injectable, type Disposable } from '@zeltjs/core';
import { EnvService } from '@zeltjs/core/modules/env';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { inject } from '@needle-di/core';

@Injectable()
export class DrizzleService implements Disposable {
  readonly db: PostgresJsDatabase;
  private client: ReturnType<typeof postgres>;

  constructor(private env = inject(EnvService)) {
    const connectionString = this.env.getString('DATABASE_URL', undefined);
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    this.client = postgres(connectionString);
    this.db = drizzle(this.client);
  }

  async shutdown(): Promise<void> {
    await this.client.end();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/service.ts src/service.test.ts
git commit -m "feat: add DrizzleService with EnvService integration"
```

---

### Task 3: Create Public Exports

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
export { DrizzleService } from './service';
```

- [ ] **Step 2: Run build to verify exports**

```bash
pnpm build
```

Expected: Build succeeds with dist/ containing index.js and index.d.ts

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add public exports"
```

---

### Task 4: Add README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# @zeltjs/drizzle

Drizzle ORM integration for zeltjs framework (PostgreSQL).

## Installation

```bash
pnpm add @zeltjs/drizzle drizzle-orm postgres
```

## Usage

Set environment variable:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
```

Inject in your service:

```typescript
import { Injectable } from '@zeltjs/core';
import { DrizzleService } from '@zeltjs/drizzle';
import { inject } from '@needle-di/core';

@Injectable()
class UserRepository {
  constructor(private drizzle = inject(DrizzleService)) {}

  async findAll() {
    return this.drizzle.db.select().from(users);
  }
}
```

Register with LifecycleManager for graceful shutdown:

```typescript
import { LifecycleManager } from '@zeltjs/core';
import { DrizzleService } from '@zeltjs/drizzle';
import { inject } from '@needle-di/core';

const lifecycle = inject(LifecycleManager);
const drizzle = inject(DrizzleService);
lifecycle.register(drizzle);
```

## Configuration

| Env Variable | Description | Default |
|--------------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | (required) |

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage examples"
```

---

### Task 5: Push and Verify

- [ ] **Step 1: Push to remote**

```bash
git push -u origin main
```

- [ ] **Step 2: Verify build and tests pass**

```bash
pnpm build && pnpm test && pnpm typecheck
```

Expected: All pass

- [ ] **Step 3: Tag initial release**

```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## Summary

This plan creates a minimal `@zeltjs/drizzle` package with:
- `DrizzleService`: Injectable service using `EnvService` for config, implementing `Disposable` for lifecycle management
- Uses drizzle-orm types directly (`PostgresJsDatabase`) - no custom type definitions
- PostgreSQL only (v0.1.0)
- Peer dependencies on `@zeltjs/core`, `drizzle-orm`, and `postgres`
