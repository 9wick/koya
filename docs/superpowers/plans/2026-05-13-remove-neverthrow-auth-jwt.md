# Remove neverthrow from auth-jwt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove neverthrow dependency from auth-jwt package and reorganize ESLint no-throw/no-try-catch rules to be globally permissive with contract-only restriction.

**Architecture:** Global ESLint rule allows throw/try-catch everywhere, then contract package overrides to enforce neverthrow usage. auth-jwt replaces `fromThrowable` pattern with native try-catch.

**Tech Stack:** ESLint, TypeScript, neverthrow (removal)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `eslint.config.mjs` | Modify | Add global no-throw/no-try-catch off, add contract-only enforcement, remove individual exceptions |
| `packages/auth-jwt/src/jwt.service.ts` | Modify | Replace neverthrow usage with try-catch |
| `packages/auth-jwt/package.json` | Modify | Remove neverthrow dependency |

---

### Task 1: Add global no-throw/no-try-catch off rule

**Files:**
- Modify: `eslint.config.mjs:101-112`

- [ ] **Step 1: Add global rule after TypeScript rules block**

In `eslint.config.mjs`, after line 112 (closing the TypeScript rules block), add:

```javascript
  {
    // Global: allow throw/try-catch everywhere (contract overrides below)
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@9wick/strict-type-rules/no-throw': 'off',
      '@9wick/strict-type-rules/no-try-catch': 'off',
    },
  },
```

- [ ] **Step 2: Verify syntax is valid**

Run: `pnpm eslint --print-config packages/core/src/index.ts | grep -A1 "no-throw"`
Expected: Shows `"@9wick/strict-type-rules/no-throw": ["off"]`

- [ ] **Step 3: Commit**

```bash
git add eslint.config.mjs
git commit -m "$(cat <<'EOF'
chore(eslint): add global no-throw/no-try-catch off rule
EOF
)"
```

---

### Task 2: Add contract-only no-throw/no-try-catch enforcement

**Files:**
- Modify: `eslint.config.mjs` (after the global rule added in Task 1)

- [ ] **Step 1: Add contract enforcement rule**

After the global rule added in Task 1, add:

```javascript
  {
    // contract package uses neverthrow (ROP) — enforce no throw/try-catch
    files: ['packages/contract/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      '@9wick/strict-type-rules/no-throw': 'error',
      '@9wick/strict-type-rules/no-try-catch': 'error',
    },
  },
```

- [ ] **Step 2: Verify contract files get the enforcement**

Run: `pnpm eslint --print-config packages/contract/src/analyzer/decorator.ts | grep -A1 "no-throw"`
Expected: Shows `"@9wick/strict-type-rules/no-throw": ["error"]`

- [ ] **Step 3: Commit**

```bash
git add eslint.config.mjs
git commit -m "$(cat <<'EOF'
chore(eslint): enforce no-throw/no-try-catch in contract package
EOF
)"
```

---

### Task 3: Remove individual no-throw/no-try-catch exceptions

**Files:**
- Modify: `eslint.config.mjs:114-132, 144-148, 156, 226, 261-262, 282, 289-290, 345, 352`

- [ ] **Step 1: Remove no-throw/no-try-catch from test/example/fixture rules (L114-125)**

Change the block at lines 114-125 from:

```javascript
  {
    files: [...TEST_FILES, ...EXAMPLE_FILES, ...FIXTURE_FILES],
    rules: {
      'no-console': 'off',
      'max-lines': ['warn', { max: 1000, skipBlankLines: true, skipComments: true }],
      'import-x/no-namespace': 'off',
      '@9wick/strict-type-rules/nestjs-like-di-for-needle-di': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@9wick/strict-type-rules/no-throw': 'off',
    },
  },
```

To:

```javascript
  {
    files: [...TEST_FILES, ...EXAMPLE_FILES, ...FIXTURE_FILES],
    rules: {
      'no-console': 'off',
      'max-lines': ['warn', { max: 1000, skipBlankLines: true, skipComments: true }],
      'import-x/no-namespace': 'off',
      '@9wick/strict-type-rules/nestjs-like-di-for-needle-di': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
```

- [ ] **Step 2: Remove core/validate-valibot no-throw/no-try-catch block (L126-132)**

Delete the entire block:

```javascript
  {
    // framework error strategy: throw + global error handler (spec §4.9 / koya phase2)
    files: ['packages/core/src/**/*.{ts,tsx}', 'packages/validate-valibot/src/**/*.{ts,tsx}'],
    rules: {
      '@9wick/strict-type-rules/no-throw': 'off',
      '@9wick/strict-type-rules/no-try-catch': 'off',
    },
  },
```

- [ ] **Step 3: Remove contract analyzer/emit no-throw/no-try-catch rules (L134-148)**

Change the block from:

```javascript
  {
    // build-time CLI tool: throw fatal errors that surface to the user via the CLI
    files: [
      'packages/contract/src/analyzer/**/*.{ts,tsx}',
      'packages/contract/src/emit/**/*.{ts,tsx}',
      'packages/contract/src/generate-client.ts',
      'packages/contract/src/watch.ts',
      'packages/contract/src/load-config.ts',
      'packages/contract/src/cli.ts',
    ],
    rules: {
      '@9wick/strict-type-rules/no-throw': 'off',
      '@9wick/strict-type-rules/no-try-catch': 'off',
      '@9wick/strict-type-rules/no-type-predicate': 'off',
    },
  },
```

To:

```javascript
  {
    // build-time CLI tool: type predicate needed for ContractError type guard
    files: [
      'packages/contract/src/generate-client.ts',
      'packages/contract/src/watch.ts',
      'packages/contract/src/load-config.ts',
      'packages/contract/src/cli.ts',
    ],
    rules: {
      '@9wick/strict-type-rules/no-type-predicate': 'off',
    },
  },
```

- [ ] **Step 4: Remove contract watch/cli no-try-catch rule (L150-159)**

Change the block from:

```javascript
  {
    // CLI tool entry points: watch loop must catch regeneration errors to keep watching
    // after a failure rather than crashing the process.
    // Type predicate and in operator needed for ContractError type guard.
    files: ['packages/contract/src/watch.ts', 'packages/contract/src/cli.ts'],
    rules: {
      '@9wick/strict-type-rules/no-try-catch': 'off',
      '@9wick/strict-type-rules/no-type-predicate': 'off',
      '@9wick/strict-type-rules/no-in-operator': 'off',
    },
  },
```

To:

```javascript
  {
    // CLI tool entry points: type predicate and in operator needed for ContractError type guard
    files: ['packages/contract/src/watch.ts', 'packages/contract/src/cli.ts'],
    rules: {
      '@9wick/strict-type-rules/no-type-predicate': 'off',
      '@9wick/strict-type-rules/no-in-operator': 'off',
    },
  },
```

- [ ] **Step 5: Remove examples no-throw rule (L218-234)**

Change the block from:

```javascript
  {
    // Example apps: relaxed rules for demo code clarity
    // - HTTPException requires throw
    // - raw fetch returns untyped JSON
    // - DI rules too strict for simple samples
    // - Workers KV returns untyped data
    files: ['examples/**/*.{ts,tsx}'],
    rules: {
      '@9wick/strict-type-rules/no-throw': 'off',
      '@9wick/strict-type-rules/no-as-assertion': 'off',
      '@9wick/strict-type-rules/nestjs-like-di-for-needle-di': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'max-lines-per-function': 'off',
    },
  },
```

To:

```javascript
  {
    // Example apps: relaxed rules for demo code clarity
    // - raw fetch returns untyped JSON
    // - DI rules too strict for simple samples
    // - Workers KV returns untyped data
    files: ['examples/**/*.{ts,tsx}'],
    rules: {
      '@9wick/strict-type-rules/no-as-assertion': 'off',
      '@9wick/strict-type-rules/nestjs-like-di-for-needle-di': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'max-lines-per-function': 'off',
    },
  },
```

- [ ] **Step 6: Remove CLI no-throw/no-try-catch rules (L247-265)**

Change the block from:

```javascript
  {
    // CLI entry points: throw/catch at user-facing boundaries for error reporting.
    // Public API returns Promise (not ResultAsync) to avoid neverthrow leak.
    // Type predicate needed for error type guard.
    files: [
      'packages/cli/src/config/loader.ts',
      'packages/cli/src/builders/tsdown.ts',
      'packages/cli/src/commands/run/runner.ts',
      'packages/cli/src/commands/run/loader.ts',
      'packages/cli/src/commands/run.ts',
      'packages/cli/src/commands/dev.ts',
      'packages/cli/src/commands/build.ts',
    ],
    rules: {
      '@9wick/strict-type-rules/no-throw': 'off',
      '@9wick/strict-type-rules/no-try-catch': 'off',
      '@9wick/strict-type-rules/no-type-predicate': 'off',
    },
  },
```

To:

```javascript
  {
    // CLI entry points: type predicate needed for error type guard
    files: [
      'packages/cli/src/config/loader.ts',
      'packages/cli/src/builders/tsdown.ts',
      'packages/cli/src/commands/run/runner.ts',
      'packages/cli/src/commands/run/loader.ts',
      'packages/cli/src/commands/run.ts',
      'packages/cli/src/commands/dev.ts',
      'packages/cli/src/commands/build.ts',
    ],
    rules: {
      '@9wick/strict-type-rules/no-type-predicate': 'off',
    },
  },
```

- [ ] **Step 7: Remove KV no-throw rule (L278-283)**

Delete the entire block:

```javascript
  {
    // KV driver uses throw for TTL validation.
    files: ['packages/kv/src/memory-kv.driver.ts'],
    rules: {
      '@9wick/strict-type-rules/no-throw': 'off',
    },
  },
```

- [ ] **Step 8: Remove Redis KV no-throw/no-try-catch rules (L285-291)**

Delete the entire block:

```javascript
  {
    // Redis KV wraps ioredis errors into KVError at the driver boundary.
    files: ['packages/kv-driver-redis/src/redis-kv-store.ts'],
    rules: {
      '@9wick/strict-type-rules/no-throw': 'off',
      '@9wick/strict-type-rules/no-try-catch': 'off',
    },
  },
```

- [ ] **Step 9: Remove command args no-throw rule (L338-346)**

Change the block from:

```javascript
  {
    // Command module uses AsyncLocalStorage and generic type inference at runtime boundaries.
    // Type assertions are needed for inferred schema types. Throws for developer errors (calling
    // args() outside command context) which should crash immediately during development.
    files: ['packages/core/src/command/primitives/args.ts'],
    rules: {
      '@9wick/strict-type-rules/no-as-assertion': 'off',
      '@9wick/strict-type-rules/no-throw': 'off',
    },
  },
```

To:

```javascript
  {
    // Command module uses AsyncLocalStorage and generic type inference at runtime boundaries.
    // Type assertions are needed for inferred schema types.
    files: ['packages/core/src/command/primitives/args.ts'],
    rules: {
      '@9wick/strict-type-rules/no-as-assertion': 'off',
    },
  },
```

- [ ] **Step 10: Remove rate-limit no-try-catch rule (L348-353)**

Delete the entire block:

```javascript
  {
    // Rate limiter wraps KV errors at the service boundary.
    files: ['packages/rate-limit/src/rate-limit.service.ts'],
    rules: {
      '@9wick/strict-type-rules/no-try-catch': 'off',
    },
  },
```

- [ ] **Step 11: Verify lint passes**

Run: `pnpm lint`
Expected: No errors (warnings are OK)

- [ ] **Step 12: Commit**

```bash
git add eslint.config.mjs
git commit -m "$(cat <<'EOF'
chore(eslint): remove individual no-throw/no-try-catch exceptions

Now handled by global off + contract-only enforcement.
EOF
)"
```

---

### Task 4: Replace neverthrow in jwt.service.ts

**Files:**
- Modify: `packages/auth-jwt/src/jwt.service.ts`
- Test: `packages/auth-jwt/src/jwt.service.test.ts`

- [ ] **Step 1: Run existing tests to verify baseline**

Run: `pnpm --filter @zeltjs/auth-jwt test`
Expected: All tests pass

- [ ] **Step 2: Remove neverthrow import and update decode method**

Change `packages/auth-jwt/src/jwt.service.ts` from:

```typescript
import { Injectable, inject } from '@zeltjs/core';
import { decodeJwt, jwtVerify, SignJWT } from 'jose';
import { fromThrowable } from 'neverthrow';

import { JwtConfig } from './jwt.config';
import type { JwtPayload } from './jwt.types';

@Injectable()
export class JwtService {
  constructor(private config = inject(JwtConfig)) {}

  async sign(payload: Record<string, unknown>): Promise<string> {
    const secret = new TextEncoder().encode(this.config.secret);
    const expiresIn = this.parseExpiresIn(this.config.expiresIn);

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(secret);

    return jwt;
  }

  async verify(token: string): Promise<JwtPayload> {
    const secret = new TextEncoder().encode(this.config.secret);
    const { payload } = await jwtVerify<JwtPayload>(token, secret);
    return payload;
  }

  decode(token: string): JwtPayload | null {
    const safeDecode = fromThrowable(decodeJwt<JwtPayload>);
    return safeDecode(token).unwrapOr(null);
  }

  private parseExpiresIn(expiresIn: string): string | number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (match) {
      const value = parseInt(match[1] ?? '0', 10);
      const unit = match[2] ?? '';
      const unitMap: Record<string, string> = {
        s: 'seconds',
        m: 'minutes',
        h: 'hours',
        d: 'days',
      };
      return `${value} ${unitMap[unit]}`;
    }
    return expiresIn;
  }
}
```

To:

```typescript
import { Injectable, inject } from '@zeltjs/core';
import { decodeJwt, jwtVerify, SignJWT } from 'jose';

import { JwtConfig } from './jwt.config';
import type { JwtPayload } from './jwt.types';

@Injectable()
export class JwtService {
  constructor(private config = inject(JwtConfig)) {}

  async sign(payload: Record<string, unknown>): Promise<string> {
    const secret = new TextEncoder().encode(this.config.secret);
    const expiresIn = this.parseExpiresIn(this.config.expiresIn);

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(secret);

    return jwt;
  }

  async verify(token: string): Promise<JwtPayload> {
    const secret = new TextEncoder().encode(this.config.secret);
    const { payload } = await jwtVerify<JwtPayload>(token, secret);
    return payload;
  }

  decode(token: string): JwtPayload | null {
    try {
      return decodeJwt<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  private parseExpiresIn(expiresIn: string): string | number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (match) {
      const value = parseInt(match[1] ?? '0', 10);
      const unit = match[2] ?? '';
      const unitMap: Record<string, string> = {
        s: 'seconds',
        m: 'minutes',
        h: 'hours',
        d: 'days',
      };
      return `${value} ${unitMap[unit]}`;
    }
    return expiresIn;
  }
}
```

- [ ] **Step 3: Run tests to verify behavior unchanged**

Run: `pnpm --filter @zeltjs/auth-jwt test`
Expected: All tests pass (decode tests verify both success and null-on-error cases)

- [ ] **Step 4: Commit**

```bash
git add packages/auth-jwt/src/jwt.service.ts
git commit -m "$(cat <<'EOF'
refactor(auth-jwt): replace neverthrow with try-catch in decode
EOF
)"
```

---

### Task 5: Remove neverthrow dependency from auth-jwt

**Files:**
- Modify: `packages/auth-jwt/package.json`

- [ ] **Step 1: Remove neverthrow from dependencies**

Change `packages/auth-jwt/package.json` dependencies from:

```json
  "dependencies": {
    "jose": "6.0.11",
    "neverthrow": "8.2.0"
  },
```

To:

```json
  "dependencies": {
    "jose": "6.0.11"
  },
```

- [ ] **Step 2: Run pnpm install to update lockfile**

Run: `pnpm install`
Expected: Lockfile updated, no errors

- [ ] **Step 3: Run tests to verify package still works**

Run: `pnpm --filter @zeltjs/auth-jwt test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/auth-jwt/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(auth-jwt): remove neverthrow dependency
EOF
)"
```

---

### Task 6: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full lint**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Verify contract enforces no-throw**

Create a temporary test file:

```bash
echo 'throw new Error("test");' > packages/contract/src/test-throw.ts
pnpm eslint packages/contract/src/test-throw.ts
rm packages/contract/src/test-throw.ts
```

Expected: ESLint error `@9wick/strict-type-rules/no-throw`

- [ ] **Step 4: Verify other packages allow throw**

Create a temporary test file:

```bash
echo 'throw new Error("test");' > packages/core/src/test-throw.ts
pnpm eslint packages/core/src/test-throw.ts
rm packages/core/src/test-throw.ts
```

Expected: No ESLint error for no-throw
