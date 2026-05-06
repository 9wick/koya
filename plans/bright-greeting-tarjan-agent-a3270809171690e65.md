# TDD/Testing Strategy Review: @zeltjs/cli Plan

## Summary

The plan describes CLI package architecture and features comprehensively, but **lacks any testing strategy**. There are no TDD steps, test categories, or test-first implementation phases defined. This is a critical gap for a CLI package where integration testing and behavior verification are essential.

## TDD Compliance

- **TDD Cycle**: Missing - No Red-Green-Refactor steps defined
- **Test-First**: No - Implementation phases list features without corresponding test steps

The plan lists implementation tasks like "citty導入、メインコマンド構造" and "`zelt build` - tsdownでトランスパイル+バンドル" but none of these have associated test specifications written before implementation.

## Testing Trophy Analysis

- **Integration Tests**: Not planned (should be the primary test layer for CLI)
- **Unit Tests**: Not planned
- **E2E Tests**: Not planned (検証方法 section shows manual verification only)
- **Balance**: N/A - No test strategy exists

The "検証方法" (Verification Method) section only describes manual bash commands, not automated tests.

## Mock Assessment

- **External boundary mocks**: Not discussed
- **Internal module mocks**: Not discussed
- **Recommendation**: The plan should specify which boundaries will require mocking:
  - File system operations (config loading, file generation)
  - Child process spawning (dev server)
  - tsdown build API calls

## Existing Test Patterns

The project has established testing patterns that should be followed:

- **Test Framework**: vitest with `describe`/`it` style
- **File Placement**: Colocated `*.test.ts` files alongside source
- **Integration Style**: Tests use real implementations (see `app.test.ts` - creates actual app and makes requests)
- **Config Testing**: See `load-config.test.ts` - uses temp directories for filesystem tests
- **Pattern**: Behavior-focused assertions, minimal mocking

**Utilities Available**:
- `packages/testing/` - test container helpers
- Temporary directory patterns in `load-config.test.ts`

## Issues

### Critical: No Testing Strategy Defined

**Severity**: Critical  
**Location**: Entire plan  
**Problem**: The plan describes what to build but not how to test it. A CLI package requires careful testing strategy because:
1. CLI commands have complex I/O interactions
2. Configuration loading involves filesystem
3. Build/dev commands spawn external processes
4. User-facing error messages must be verified

**Suggestion**: Add a dedicated "Testing Strategy" section before implementation phases with TDD steps.

**Example - TDD Structure for Phase 1**:
```markdown
### Phase 1: 基盤 + build (TDD)

#### Step 1.1: defineConfig (Red-Green-Refactor)
- [ ] TEST: `defineConfig` returns input with type narrowing
- [ ] TEST: `defineConfig` accepts build config options
- [ ] IMPL: Create `config/schema.ts` with types
- [ ] IMPL: Create `config/index.ts` with defineConfig

#### Step 1.2: loadConfig (Red-Green-Refactor)
- [ ] TEST: `loadConfig` finds `zelt.config.ts` in cwd
- [ ] TEST: `loadConfig` returns undefined when no config exists
- [ ] TEST: `loadConfig` merges build defaults
- [ ] IMPL: Create config loader using existing pattern from contract

#### Step 1.3: build command (Red-Green-Refactor)
- [ ] TEST: `zelt build` reads config and invokes tsdown
- [ ] TEST: `zelt build --outDir` overrides config
- [ ] TEST: `zelt build` fails gracefully on missing entry
- [ ] IMPL: Create build command
```

### High: Missing Test File Structure

**Severity**: High  
**Location**: パッケージ構造  
**Problem**: The package structure diagram shows no test files. Following project conventions, tests should be colocated.

**Suggestion**: Add test file locations to the structure:
```
packages/cli/
└── src/
    ├── config/
    │   ├── index.ts
    │   ├── index.test.ts        # <-- Add
    │   ├── schema.ts
    │   └── schema.test.ts       # <-- Add (type tests)
    ├── commands/
    │   ├── build.ts
    │   ├── build.test.ts        # <-- Add
    │   ├── dev.ts
    │   └── dev.test.ts          # <-- Add
```

### High: Manual Verification Instead of Automated Tests

**Severity**: High  
**Location**: 検証方法 section  
**Problem**: The verification section shows only manual bash commands. These should be automated integration tests.

**Before** (current plan):
```bash
# Phase 2
npx zelt build
```

**After** (with automated tests):
```typescript
// commands/build.test.ts
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('zelt build', () => {
  let projectDir: string;
  
  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'zelt-build-'));
    await writeFile(join(projectDir, 'zelt.config.ts'), `
      export default { build: { entry: './src/main.ts', outDir: './dist' } }
    `);
    await writeFile(join(projectDir, 'src/main.ts'), `console.log('hello')`);
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('produces output in configured outDir', async () => {
    await execa('zelt', ['build'], { cwd: projectDir });
    const exists = await stat(join(projectDir, 'dist')).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('fails with helpful error when entry file missing', async () => {
    await rm(join(projectDir, 'src/main.ts'));
    const result = await execa('zelt', ['build'], { cwd: projectDir, reject: false });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('entry file not found');
  });
});
```

### Medium: No Error Scenario Tests Planned

**Severity**: Medium  
**Location**: 実装フェーズ  
**Problem**: No test cases for error paths are defined. CLI tools must handle errors gracefully.

**Suggestion**: Add error scenario tests for each command:
- Missing config file behavior
- Invalid config format errors
- Build failures (missing entry, syntax errors)
- Dev server port conflicts
- Generate command with existing file conflicts

### Medium: No Test Isolation Strategy for Dev Server

**Severity**: Medium  
**Location**: Phase 2: dev  
**Problem**: Testing `zelt dev` (process restart mode) requires careful isolation. The plan doesn't address:
- How to test file watching triggers restart
- How to verify server actually restarts
- How to clean up spawned processes in tests

**Suggestion**: Add test strategy for dev command:
```typescript
// dev-server/index.test.ts
import { describe, it, expect, afterEach } from 'vitest';

describe('dev server', () => {
  let serverProcess: ChildProcess | undefined;

  afterEach(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => serverProcess!.on('exit', resolve));
    }
  });

  it('restarts when source file changes', async () => {
    // Start server, track process IDs
    // Modify source file
    // Verify new process spawned
  });
});
```

### Low: Existing loadConfig Pattern Not Referenced

**Severity**: Low  
**Location**: 設定システム  
**Problem**: The plan mentions creating a new config system but `packages/contract/src/load-config.ts` already has tested patterns for config discovery. The plan should reference this for consistency.

**Suggestion**: Explicitly reference existing patterns:
```markdown
## 設定システム
- 既存の `packages/contract/src/load-config.ts` パターンを踏襲
- テストパターンも `load-config.test.ts` を参考に
```

## Recommendations

1. **Add Testing Strategy Section (Critical)**: Before any implementation, define what tests will be written for each feature. Follow the existing project pattern of behavior-focused integration tests.

2. **Apply TDD to Each Phase**: Restructure phases to show test-first steps:
   ```
   Phase 1.1: defineConfig
   - [ ] Write test: returns input with type narrowing
   - [ ] Implement: minimal defineConfig
   - [ ] Write test: accepts build options
   - [ ] Extend implementation
   ```

3. **Prioritize Integration Tests**: Following Testing Trophy, most tests should be integration-level (invoke CLI command, verify file output) rather than unit tests of internal functions.

4. **Minimize Mocks**: Based on project patterns, prefer:
   - Real filesystem with temp directories (pattern from `load-config.test.ts`)
   - Real tsdown API calls in tests
   - Only mock external network calls if any

5. **Add Test File Locations**: Update package structure to show test file placement following the project's colocation pattern.

6. **Define Error Path Tests**: For each command, list expected error scenarios and their test cases.

7. **Reference Existing Patterns**: The plan should explicitly reference:
   - `load-config.test.ts` for filesystem testing patterns
   - `options.test.ts` for config type testing patterns
   - `app.test.ts` for integration testing style
