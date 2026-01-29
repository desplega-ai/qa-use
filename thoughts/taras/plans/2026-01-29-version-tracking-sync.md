---
date: 2026-01-29T14:50:00Z
topic: "Version Tracking Integration for qa-use CLI Sync"
author: Claude
status: completed
---

# Plan: Version Tracking Integration for qa-use CLI Sync

## Summary

Implement version tracking for the `qa-use test sync` command to enable conflict detection during push operations. The backend API has been updated to support `version_hash` fields in import/export, and we need to update the CLI to leverage this.

## Context

The `/vibe-qa/cli/import` and `/vibe-qa/cli/export` endpoints now support version tracking:

1. **Export** returns `version_hash` in TestDefinition when present
2. **Import** accepts `version_hash` in TestDefinition and `force` flag in request
3. **Import response** now includes:
   - New action: `'conflict'` (in addition to created/updated/skipped/unchanged)
   - `message` field for conflict details
   - `prev_version_hash` and `version_hash` fields

## Current State

### sync.ts (src/cli/commands/test/sync.ts)
- **Pull**: Fetches tests, writes YAML files, skips existing unless `--force`
- **Push**: Loads local YAML files, imports with `upsert: true`
- **No version tracking**: Neither stores nor sends `version_hash`
- **Force flag**: Exists but only used for pull (overwrite local files)

### Types (lib/api/index.ts)
```typescript
// Current - needs updates
interface ImportOptions {
  upsert?: boolean;
  dry_run?: boolean;
}

interface ImportedTest {
  name: string;
  id: string;
  action: 'created' | 'updated' | 'skipped';
}
```

### TestDefinition (src/types/test-definition.ts)
- Auto-generated from API schema
- Does NOT currently include `version_hash` field
- Has `[k: string]: unknown` escape hatch, so it will accept version_hash

---

## Implementation Plan

### Phase 1: Update Types ✅ DONE

**File**: `lib/api/index.ts`

1. Update `ImportOptions` interface:
```typescript
interface ImportOptions {
  upsert?: boolean;
  dry_run?: boolean;
  force?: boolean;  // NEW: override version conflicts
}
```

2. Update `ImportedTest` interface:
```typescript
interface ImportedTest {
  name: string;
  id: string;
  action: 'created' | 'updated' | 'skipped' | 'unchanged' | 'conflict';  // UPDATED
  message?: string;           // NEW: Warning/conflict details
  prev_version_hash?: string; // NEW: Hash before operation
  version_hash?: string;      // NEW: Hash after operation
}
```

3. Update `importTestDefinition` method to pass `force` option:
```typescript
async importTestDefinition(
  definitions: TestDefinition[],
  options: ImportOptions = {}
): Promise<ImportResult> {
  // ...
  const response = await this.client.post('/vibe-qa/cli/import', {
    test_definitions: definitions,
    upsert: options.upsert ?? true,
    dry_run: options.dry_run ?? false,
    force: options.force ?? false,  // NEW
  });
  // ...
}
```

**Verification**: Run `bun run lint:fix && bun run format` and `bun run typecheck`

**Unit Tests** (add to `lib/api/index.test.ts` or create if missing):
```typescript
describe('importTestDefinition', () => {
  it('should pass force option when provided', async () => {
    // Mock axios post
    const mockPost = vi.fn().mockResolvedValue({ data: { success: true, imported: [] } });
    // ...setup client with mock

    await client.importTestDefinition([testDef], { upsert: true, force: true });

    expect(mockPost).toHaveBeenCalledWith('/vibe-qa/cli/import', expect.objectContaining({
      force: true,
    }));
  });

  it('should default force to false', async () => {
    await client.importTestDefinition([testDef], { upsert: true });

    expect(mockPost).toHaveBeenCalledWith('/vibe-qa/cli/import', expect.objectContaining({
      force: false,
    }));
  });
});
```

---

### Phase 2: Update Pull to Store version_hash ✅ DONE (No changes needed)

**File**: `src/cli/commands/test/sync.ts`

The pull flow already exports tests as YAML. Since the export endpoint now returns `version_hash` in the test definition, it should automatically be included in the YAML output.

**Verification**:
1. Run a pull against local backend
2. Check that YAML files include `version_hash` field

If the export doesn't include version_hash automatically:
- The export endpoint returns raw YAML from the backend
- The backend should already be including `version_hash` in the export
- No CLI changes needed for pull

**Unit Tests** (verify YAML parsing preserves version_hash):
```typescript
describe('pullFromCloud', () => {
  it('should preserve version_hash from exported YAML', async () => {
    const mockExportYaml = `
name: Test
id: abc-123
version_hash: xyz789
steps: []
`;
    // Mock client.exportTest to return YAML with version_hash
    // Verify written file contains version_hash
  });
});
```

---

### Phase 3: Update Push to Send version_hash and Handle Conflicts ✅ DONE

**File**: `src/cli/commands/test/sync.ts`

1. Pass `force` option to import call:
```typescript
const result = await client.importTestDefinition(
  definitions.map((d) => d.def),
  { upsert: true, force: options.force }
);
```

2. Update result handling to support new actions:
```typescript
if (result.success) {
  let hasConflicts = false;

  for (const imported of result.imported) {
    switch (imported.action) {
      case 'created':
        console.log(success(`  Created: ${imported.name} (${imported.id})`));
        break;
      case 'updated':
        console.log(success(`  Updated: ${imported.name} (${imported.id})`));
        break;
      case 'unchanged':
        console.log(info(`  Unchanged: ${imported.name}`));
        break;
      case 'conflict':
        console.log(warning(`  CONFLICT: ${imported.name} - ${imported.message}`));
        hasConflicts = true;
        break;
      case 'skipped':
        console.log(info(`  Skipped: ${imported.name}`));
        break;
    }
  }

  if (hasConflicts) {
    console.log('');
    console.log(warning('Conflicts detected. Use --force to overwrite, or pull first to get latest versions.'));
  }

  // ... summary
}
```

3. Update local files with new version_hash after successful push:
```typescript
// After successful import, update local files with returned version_hash
for (const imported of result.imported) {
  if (imported.version_hash && (imported.action === 'created' || imported.action === 'updated')) {
    // Find the local file for this test and update its version_hash
    const localDef = definitions.find(d =>
      d.def.id === imported.id || d.def.name === imported.name
    );
    if (localDef) {
      await updateLocalVersionHash(localDef.file, imported.version_hash);
    }
  }
}
```

4. Add helper function to update version_hash in local file:
```typescript
async function updateLocalVersionHash(filePath: string, versionHash: string): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const doc = yaml.parseDocument(content);
  doc.set('version_hash', versionHash);
  await fs.writeFile(filePath, doc.toString(), 'utf-8');
}
```

**Verification**: Run `bun run lint:fix && bun run format`

**Unit Tests** (add to `src/cli/commands/test/sync.test.ts` or create):
```typescript
describe('pushToCloud', () => {
  it('should handle conflict action and set hasConflicts flag', async () => {
    const mockResult = {
      success: true,
      imported: [
        { name: 'Test1', id: '1', action: 'conflict', message: 'Remote modified' }
      ],
      errors: []
    };
    // Mock importTestDefinition, verify warning is logged
  });

  it('should pass --force flag to importTestDefinition', async () => {
    // Verify force option is passed through
  });
});

describe('updateLocalVersionHash', () => {
  it('should update version_hash in YAML file', async () => {
    const tempFile = '/tmp/test.yaml';
    await fs.writeFile(tempFile, 'name: Test\nsteps: []\n');

    await updateLocalVersionHash(tempFile, 'newhash123');

    const content = await fs.readFile(tempFile, 'utf-8');
    expect(content).toContain('version_hash: newhash123');
  });

  it('should preserve existing YAML structure', async () => {
    const tempFile = '/tmp/test.yaml';
    await fs.writeFile(tempFile, 'name: Test\nid: abc\nsteps: []\n');

    await updateLocalVersionHash(tempFile, 'hash');

    const content = await fs.readFile(tempFile, 'utf-8');
    expect(content).toContain('name: Test');
    expect(content).toContain('id: abc');
  });
});
```

---

### Phase 4: Manual E2E Testing ✅ DONE

Using `.qa-use-tests.json` config (pointing to local backend):

```bash
# 1. Initial state - no version tracking
bun run cli test sync --push
# Expected: All tests created/updated, no version_hash in local files yet

# 2. Pull to get version hashes
bun run cli test sync --pull --force
# Expected: Files now have version_hash field

# 3. Push with version tracking enabled
bun run cli test sync --push
# Expected: All tests unchanged (hashes match)

# 4. Simulate conflict - modify a test on the backend
# (manually via API or UI)

# 5. Push again - should detect conflict
bun run cli test sync --push
# Expected: CONFLICT message for modified test

# 6. Force push - should override
bun run cli test sync --push --force
# Expected: Test updated (forced)
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `lib/api/index.ts` | Add `force` to ImportOptions, update ImportedTest interface, pass force in request |
| `src/cli/commands/test/sync.ts` | Handle conflict action, update local version_hash after push, pass force option |

## Files NOT to Modify

- `src/types/test-definition.ts` - Auto-generated, and `[k: string]: unknown` allows version_hash

---

## Risks & Considerations

1. **Backward Compatibility**:
   - Old CLI without version_hash still works (backend returns warning)
   - New CLI with old backend also works (version_hash simply ignored)

2. **File Parsing**:
   - Using `yaml.parseDocument()` preserves comments and formatting when updating version_hash
   - JSON files will need different handling (currently the codebase seems YAML-focused)

3. **Multi-document YAML**:
   - Pull writes individual files for each test, so version_hash is per-file
   - This is the correct behavior

4. **ID vs Name matching**:
   - When updating local files after push, we match by ID first, then name
   - New tests won't have ID until after first push

---

## Success Criteria

1. `qa-use test sync --pull` stores `version_hash` in local YAML files
2. `qa-use test sync --push` sends `version_hash` from local files
3. Conflicts are detected and reported with clear messaging
4. `--force` flag overrides conflicts on push
5. Local files are updated with new `version_hash` after successful push
6. All existing functionality continues to work

---

## Implementation Status

### Completed ✅

| Phase | Description | Files Modified |
|-------|-------------|----------------|
| Phase 1 | Update Types | `lib/api/index.ts` - Added `force` to ImportOptions, updated ImportedTest with new actions and fields |
| Phase 2 | Pull version_hash | No changes needed - export endpoint already returns version_hash in YAML |
| Phase 3 | Push & Conflicts | `src/cli/commands/test/sync.ts` - Handle conflicts, update local version_hash, pass force option |
| Unit Tests | Added tests | `lib/api/index.test.ts` (6 tests), `src/cli/commands/test/sync.test.ts` (6 tests) |
| Bugfix | Validation error display | `lib/api/index.ts` - Fixed `[object Object]` error to show actual validation messages |
| Bonus | `test diff` command | `src/cli/commands/test/diff.ts` - Compare local test with cloud version |
| Bonus | Conflict diff suggestion | `src/cli/commands/test/sync.ts` - Show `qa-use test diff <file>` when conflicts detected |

**All 117 tests passing.**

---

## Bonus Feature: `test diff` Command

Added `qa-use test diff <file>` to compare local test with cloud version:

**No differences:**
```bash
$ qa-use test diff go-to-customers-page
ℹ Comparing local test with cloud version...
  Local: qa-tests/go-to-customers-page.yaml
  Cloud: 4292938b-338d-4c1c-952e-6bcdf3f7731a
Field Comparison:
────────────────────────────────────────

  version_hash:
    local: aa658230e964ec2a145ea6cb7199de97decb93318d5866aa8e8add1674966afc
    cloud: aa658230e964ec2a145ea6cb7199de97decb93318d5866aa8e8add1674966afc

  No differences in key fields
```

**With field differences:**
```bash
$ qa-use test diff navigation-checks
ℹ Comparing local test with cloud version...
  Local: qa-tests/navigation-checks.yaml
  Cloud: 6c48fb50-d76f-4346-93b1-845fb4ace2e6
Field Comparison:
────────────────────────────────────────

  name:
    local: "Navigation > Checks MODIFIED"
    cloud: "Navigation > Checks"

  tags:
    local: ["modified-tag","e2e","other"]
    cloud: ["e2e","other"]

  version_hash:
    local: fake
    cloud: 69153cf41d10da814d8234d377954defdc4a44d8ec0d0a5041e4616ec9be4f72
```

Options:
- `--full`: Show full line-by-line YAML diff

When sync detects conflicts, it now suggests the diff command:
```bash
⚠ Conflicts detected. To see differences, run:
  qa-use test diff navigation-checks

ℹ Then use --force to overwrite, or --pull to get latest versions.
```

Note: File extension is optional for `test diff` command.

---

## Resolving Conflicts

When a conflict is detected, you have two options:

| Option | Command | Use When |
|--------|---------|----------|
| **Pull (recommended)** | `qa-use test sync --pull --force` | You want to discard local changes and get the latest cloud version |
| **Force Push** | `qa-use test sync --push --force` | You want to overwrite cloud with your local version |

**Workflow:**
1. Run `qa-use test diff <file>` to see what's different
2. Decide which version to keep:
   - If cloud version is correct → `--pull --force`
   - If local version is correct → `--push --force`
3. After resolving, the `version_hash` will be in sync

### E2E Test Results ✅

**Step 1: Initial push**
```bash
$ bun run cli test sync --push
ℹ Loading local tests from ./qa-tests...
Found 4 local test(s)
Importing to cloud...
✓   Updated: Navigation > Checks (6c48fb50-d76f-4346-93b1-845fb4ace2e6)
✓   Updated: Login (a362969f-0b1a-4de8-b0aa-694717b60a7e)
✓   Updated: Go to customers page (4292938b-338d-4c1c-952e-6bcdf3f7731a)
✓   Updated: Customers > Go to second page (74628094-00ce-4f81-b928-9a369a63f25b)
✓ Pushed 4 test(s)
```

**Step 2: Pull to get version hashes**
```bash
$ bun run cli test sync --pull --force
ℹ Fetching tests from cloud...
Found 100 cloud test(s)
✓   login.yaml
...
✓ Pulled 100 test(s), skipped 0

$ grep version_hash ./qa-tests/login.yaml
version_hash: 1d43c1ef472ba55ed6f274eab5b574434c2ce893cbc4c756365202f90050120b
```

**Step 3: Push again - shows unchanged**
```bash
$ bun run cli test sync --push
ℹ Loading local tests from ./qa-tests...
Found 4 local test(s)
Importing to cloud...
ℹ   Unchanged: Navigation > Checks
ℹ   Unchanged: Login
ℹ   Unchanged: Go to customers page
ℹ   Unchanged: Customers > Go to second page
✓ Pushed 4 test(s)
```

**Step 4: Simulate conflict (change local version_hash)**
```bash
$ sed -i '' 's/version_hash:.*/version_hash: fake_old_hash_12345/' ./qa-tests/login.yaml
$ grep version_hash ./qa-tests/login.yaml
version_hash: fake_old_hash_12345
```

**Step 5: Push - detects conflict**
```bash
$ bun run cli test sync --push
ℹ Loading local tests from ./qa-tests...
Found 4 local test(s)
Importing to cloud...
ℹ   Unchanged: Navigation > Checks
⚠   CONFLICT: Login - Remote modified. Local version: fake_old..., remote version: 1d43c1ef...
ℹ   Unchanged: Go to customers page
ℹ   Unchanged: Customers > Go to second page
⚠ Conflicts detected. Use --force to overwrite, or pull first to get latest versions.
✓ Pushed 4 test(s)
```

**Step 6: Force push - overrides conflict**
```bash
$ bun run cli test sync --push --force
ℹ Loading local tests from ./qa-tests...
Found 4 local test(s)
Importing to cloud...
ℹ   Unchanged: Navigation > Checks
ℹ   Unchanged: Login
ℹ   Unchanged: Go to customers page
ℹ   Unchanged: Customers > Go to second page
✓ Pushed 4 test(s)
```

**Note:** When `--force` is used with unchanged content, backend returns "unchanged" so local version_hash isn't updated. Use `--pull` to refresh local hashes if needed.
