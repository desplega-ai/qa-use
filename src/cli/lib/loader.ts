/**
 * Test definition file discovery and loading
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as yaml from 'yaml';
import type { TestDefinition } from '../../../src/types/test-definition.js';

/**
 * Discover test definition files in a directory
 *
 * @param directory - Directory to search (default: ./qa-tests)
 * @returns Array of file paths
 */
export async function discoverTests(directory: string = './qa-tests'): Promise<string[]> {
  const pattern = path.join(directory, '**/*.{yaml,yml,json}');
  return await glob(pattern);
}

/**
 * Load a single test definition from a file
 *
 * @param filePath - Path to test definition file
 * @returns TestDefinition object
 */
export async function loadTestDefinition(filePath: string): Promise<TestDefinition> {
  const content = await fs.readFile(filePath, 'utf-8');

  if (filePath.endsWith('.json')) {
    return JSON.parse(content) as TestDefinition;
  }

  // Parse YAML
  return yaml.parse(content) as TestDefinition;
}

/**
 * Resolve test name or path to full file path
 *
 * @param testNameOrPath - Test name (e.g., "auth/login") or path
 * @param directory - Test directory root
 * @returns Full path to test file
 */
export function resolveTestPath(testNameOrPath: string, directory: string): string {
  // If it's already an absolute path, return it
  if (path.isAbsolute(testNameOrPath)) {
    return testNameOrPath;
  }

  // If it's a relative path with extension, resolve it
  if (testNameOrPath.match(/\.(yaml|yml|json)$/)) {
    return path.resolve(directory, testNameOrPath);
  }

  // Try to find file with various extensions
  const extensions = ['.yaml', '.yml', '.json'];

  for (const ext of extensions) {
    const fullPath = path.resolve(directory, testNameOrPath + ext);
    return fullPath; // Return first match (we'll check existence when reading)
  }

  throw new Error(`Test file not found: ${testNameOrPath}`);
}

/**
 * Load a test and all its dependencies recursively
 *
 * @param testName - Test name or path
 * @param directory - Test directory root
 * @returns Array of TestDefinitions (dependencies first, then the test)
 */
export async function loadTestWithDeps(
  testName: string,
  directory: string
): Promise<TestDefinition[]> {
  const definitions: TestDefinition[] = [];
  const loaded = new Set<string>();

  async function loadRecursive(name: string) {
    // Avoid circular dependencies
    if (loaded.has(name)) return;
    loaded.add(name);

    const filePath = resolveTestPath(name, directory);
    const def = await loadTestDefinition(filePath);

    // Load dependency first (if it exists and is a local file)
    if (def.depends_on) {
      // Check if depends_on is a UUID (cloud test) or a file name
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        def.depends_on
      );

      if (!isUuid) {
        // It's a local file reference
        await loadRecursive(def.depends_on);
      }
      // If it's a UUID, the API will resolve it
    }

    definitions.push(def);
  }

  await loadRecursive(testName);
  return definitions;
}

/**
 * Load all test definitions from a directory
 *
 * @param directory - Test directory root
 * @returns Array of TestDefinitions
 */
export async function loadAllTests(directory: string): Promise<TestDefinition[]> {
  const files = await discoverTests(directory);
  const definitions: TestDefinition[] = [];

  for (const file of files) {
    try {
      const def = await loadTestDefinition(file);
      definitions.push(def);
    } catch (error) {
      console.error(`Warning: Failed to load ${file}:`, error);
    }
  }

  return definitions;
}

/**
 * Apply variable overrides to test definitions
 *
 * @param definitions - Test definitions to modify
 * @param overrides - Variable overrides { key: value }
 */
export function applyVariableOverrides(
  definitions: TestDefinition[],
  overrides: Record<string, string>
): void {
  for (const def of definitions) {
    if (!def.variables) {
      def.variables = {};
    }

    Object.assign(def.variables, overrides);
  }
}
