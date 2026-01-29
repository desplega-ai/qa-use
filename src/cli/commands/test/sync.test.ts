/**
 * qa-use test sync - Unit Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { updateLocalVersionHash } from './sync.js';

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
