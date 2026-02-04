/**
 * qa-use test sync - Unit Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { syncCommand, updateLocalVersionHash } from './sync.js';

describe('syncCommand', () => {
  describe('command structure', () => {
    it('should have pull and push subcommands', () => {
      const subcommands = syncCommand.commands.map((c) => c.name());
      expect(subcommands).toContain('pull');
      expect(subcommands).toContain('push');
    });

    it('should have correct description', () => {
      expect(syncCommand.description()).toBe('Sync local tests with cloud');
    });
  });

  describe('pull subcommand', () => {
    const pullCommand = syncCommand.commands.find((c) => c.name() === 'pull');

    it('should exist', () => {
      expect(pullCommand).toBeDefined();
    });

    it('should have correct description', () => {
      expect(pullCommand?.description()).toBe('Pull tests from cloud to local');
    });

    it('should have --id option', () => {
      const idOption = pullCommand?.options.find((o) => o.long === '--id');
      expect(idOption).toBeDefined();
      expect(idOption?.description).toBe('Pull single test by ID');
    });

    it('should have --app-config-id option', () => {
      const appConfigOption = pullCommand?.options.find((o) => o.long === '--app-config-id');
      expect(appConfigOption).toBeDefined();
      expect(appConfigOption?.description).toBe('Pull tests for specific app config');
    });

    it('should have --dry-run option', () => {
      const dryRunOption = pullCommand?.options.find((o) => o.long === '--dry-run');
      expect(dryRunOption).toBeDefined();
      expect(dryRunOption?.description).toBe('Show what would be synced without making changes');
    });

    it('should have --force option', () => {
      const forceOption = pullCommand?.options.find((o) => o.long === '--force');
      expect(forceOption).toBeDefined();
      expect(forceOption?.description).toBe('Overwrite existing files without prompting');
    });
  });

  describe('push subcommand', () => {
    const pushCommand = syncCommand.commands.find((c) => c.name() === 'push');

    it('should exist', () => {
      expect(pushCommand).toBeDefined();
    });

    it('should have correct description', () => {
      expect(pushCommand?.description()).toBe('Push local tests to cloud');
    });

    it('should have --id option', () => {
      const idOption = pushCommand?.options.find((o) => o.long === '--id');
      expect(idOption).toBeDefined();
      expect(idOption?.description).toBe('Push single test by ID');
    });

    it('should have --all option', () => {
      const allOption = pushCommand?.options.find((o) => o.long === '--all');
      expect(allOption).toBeDefined();
      expect(allOption?.description).toBe('Push all local tests');
    });

    it('should have --dry-run option', () => {
      const dryRunOption = pushCommand?.options.find((o) => o.long === '--dry-run');
      expect(dryRunOption).toBeDefined();
      expect(dryRunOption?.description).toBe('Show what would be synced without making changes');
    });

    it('should have --force option', () => {
      const forceOption = pushCommand?.options.find((o) => o.long === '--force');
      expect(forceOption).toBeDefined();
      expect(forceOption?.description).toBe('Overwrite cloud tests without version check');
    });
  });

  describe('option parsing', () => {
    describe('pull command options', () => {
      const pullCommand = syncCommand.commands.find((c) => c.name() === 'pull');

      it('should parse --id option with argument', () => {
        const idOption = pullCommand?.options.find((o) => o.long === '--id');
        // Commander stores the argument template in 'flags'
        expect(idOption?.flags).toContain('<uuid>');
      });

      it('should parse --app-config-id option with argument', () => {
        const appConfigOption = pullCommand?.options.find((o) => o.long === '--app-config-id');
        expect(appConfigOption?.flags).toContain('<id>');
      });

      it('should have boolean --dry-run option (no argument)', () => {
        const dryRunOption = pullCommand?.options.find((o) => o.long === '--dry-run');
        // Boolean options don't have argument brackets in flags
        expect(dryRunOption?.flags).not.toContain('<');
        expect(dryRunOption?.flags).not.toContain('[');
      });

      it('should have boolean --force option (no argument)', () => {
        const forceOption = pullCommand?.options.find((o) => o.long === '--force');
        expect(forceOption?.flags).not.toContain('<');
        expect(forceOption?.flags).not.toContain('[');
      });
    });

    describe('push command options', () => {
      const pushCommand = syncCommand.commands.find((c) => c.name() === 'push');

      it('should parse --id option with argument', () => {
        const idOption = pushCommand?.options.find((o) => o.long === '--id');
        expect(idOption?.flags).toContain('<uuid>');
      });

      it('should have boolean --all option (no argument)', () => {
        const allOption = pushCommand?.options.find((o) => o.long === '--all');
        expect(allOption?.flags).not.toContain('<');
        expect(allOption?.flags).not.toContain('[');
      });

      it('should have boolean --dry-run option (no argument)', () => {
        const dryRunOption = pushCommand?.options.find((o) => o.long === '--dry-run');
        expect(dryRunOption?.flags).not.toContain('<');
        expect(dryRunOption?.flags).not.toContain('[');
      });

      it('should have boolean --force option (no argument)', () => {
        const forceOption = pushCommand?.options.find((o) => o.long === '--force');
        expect(forceOption?.flags).not.toContain('<');
        expect(forceOption?.flags).not.toContain('[');
      });
    });
  });

  describe('subcommand hierarchy', () => {
    it('should have syncCommand as parent of pull and push', () => {
      const pullCommand = syncCommand.commands.find((c) => c.name() === 'pull');
      const pushCommand = syncCommand.commands.find((c) => c.name() === 'push');

      expect(pullCommand?.parent?.name()).toBe('sync');
      expect(pushCommand?.parent?.name()).toBe('sync');
    });

    it('should allow chaining: qa-use test sync pull', () => {
      // The sync command should have the pull subcommand
      const pullCommand = syncCommand.commands.find((c) => c.name() === 'pull');
      expect(pullCommand).toBeDefined();
      expect(pullCommand?.name()).toBe('pull');
    });

    it('should allow chaining: qa-use test sync push', () => {
      // The sync command should have the push subcommand
      const pushCommand = syncCommand.commands.find((c) => c.name() === 'push');
      expect(pushCommand).toBeDefined();
      expect(pushCommand?.name()).toBe('push');
    });
  });
});

describe('updateLocalVersionHash', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-use-sync-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should add version_hash to YAML file without one', async () => {
    const testFile = path.join(tempDir, 'test.yaml');
    await fs.writeFile(testFile, 'name: Test\nsteps: []\n');

    await updateLocalVersionHash(testFile, 'newhash123');

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('version_hash: newhash123');
    expect(content).toContain('name: Test');
    expect(content).toContain('steps: []');
  });

  it('should update existing version_hash in YAML file', async () => {
    const testFile = path.join(tempDir, 'test.yaml');
    await fs.writeFile(testFile, 'name: Test\nversion_hash: oldhash\nsteps: []\n');

    await updateLocalVersionHash(testFile, 'newhash456');

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('version_hash: newhash456');
    expect(content).not.toContain('oldhash');
  });

  it('should preserve existing YAML structure and order', async () => {
    const testFile = path.join(tempDir, 'test.yaml');
    const originalContent = `name: My Test
id: abc-123
description: A test description
url: https://example.com
steps:
  - goto: https://example.com
  - click:
      ref: e1
`;
    await fs.writeFile(testFile, originalContent);

    await updateLocalVersionHash(testFile, 'hash789');

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('version_hash: hash789');
    expect(content).toContain('name: My Test');
    expect(content).toContain('id: abc-123');
    expect(content).toContain('description: A test description');
    expect(content).toContain('url: https://example.com');
    expect(content).toContain('goto: https://example.com');
  });

  it('should handle YAML with comments', async () => {
    const testFile = path.join(tempDir, 'test.yaml');
    const originalContent = `# This is a test file
name: Test With Comments
# Another comment
steps: []
`;
    await fs.writeFile(testFile, originalContent);

    await updateLocalVersionHash(testFile, 'commenthash');

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('version_hash: commenthash');
    expect(content).toContain('# This is a test file');
    expect(content).toContain('# Another comment');
  });

  it('should handle complex nested YAML structures', async () => {
    const testFile = path.join(tempDir, 'test.yaml');
    const originalContent = `name: Complex Test
variables:
  username: admin
  password: secret
steps:
  - goto: https://example.com
  - fill:
      ref: e1
      value: "{{ username }}"
  - fill:
      ref: e2
      value: "{{ password }}"
  - click:
      text: Submit
`;
    await fs.writeFile(testFile, originalContent);

    await updateLocalVersionHash(testFile, 'complexhash');

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toContain('version_hash: complexhash');
    expect(content).toContain('username: admin');
    expect(content).toContain('password: secret');
    expect(content).toContain('value: "{{ username }}"');
  });

  it('should throw error for non-existent file', async () => {
    const nonExistentFile = path.join(tempDir, 'does-not-exist.yaml');

    await expect(updateLocalVersionHash(nonExistentFile, 'hash')).rejects.toThrow();
  });
});
