/**
 * ID injection utility for YAML test definition files
 *
 * After a test is persisted to the cloud, this utility injects the
 * assigned test ID back into the original YAML file, enabling
 * round-trip synchronization between local files and cloud tests.
 */

import * as fs from 'node:fs/promises';
import * as yaml from 'yaml';
import type { TestDefinition } from '../../types/test-definition.js';

/**
 * Inject a test ID into a YAML file
 *
 * This function preserves comments and formatting by:
 * 1. Parsing with yaml library that preserves structure
 * 2. Adding/updating the 'id' field at the document root
 * 3. Writing back with preserved formatting
 *
 * @param filePath - Path to the YAML test definition file
 * @param testId - UUID to inject
 * @returns True if file was modified, false if ID already present
 */
export async function injectTestId(filePath: string, testId: string): Promise<boolean> {
  // Read file content
  const content = await fs.readFile(filePath, 'utf-8');

  // Parse as YAML document to preserve comments/formatting
  const doc = yaml.parseDocument(content);

  // Check if ID already exists and matches
  const existingId = doc.get('id');
  if (existingId === testId) {
    return false; // No change needed
  }

  // Add or update the id field
  // For simplicity, we use set() which adds to end if not present
  // Then we re-order the keys by reconstructing the content
  doc.set('id', testId);

  // If we want id first, we need to reorder the map
  const contents = doc.contents;
  if (yaml.isMap(contents) && !existingId) {
    // Find the id item and move it to front
    const items = contents.items;
    const idIndex = items.findIndex((item) => {
      const key = yaml.isScalar(item.key) ? item.key.value : item.key;
      return key === 'id';
    });

    if (idIndex > 0) {
      const idItem = items.splice(idIndex, 1)[0];
      items.unshift(idItem);
    }
  }

  // Write back to file
  const output = doc.toString();
  await fs.writeFile(filePath, output, 'utf-8');

  return true;
}

/**
 * Inject multiple test IDs into their corresponding files
 *
 * @param mappings - Array of { filePath, testId } pairs
 * @returns Summary of injections performed
 */
export async function injectTestIds(
  mappings: Array<{ filePath: string; testId: string }>
): Promise<{
  injected: string[];
  skipped: string[];
  errors: Array<{ filePath: string; error: string }>;
}> {
  const result = {
    injected: [] as string[],
    skipped: [] as string[],
    errors: [] as Array<{ filePath: string; error: string }>,
  };

  for (const { filePath, testId } of mappings) {
    try {
      // Only process YAML files
      if (!filePath.match(/\.(yaml|yml)$/)) {
        result.skipped.push(filePath);
        continue;
      }

      const modified = await injectTestId(filePath, testId);

      if (modified) {
        result.injected.push(filePath);
      } else {
        result.skipped.push(filePath);
      }
    } catch (error) {
      result.errors.push({
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * Extract ID from a test definition file
 *
 * @param filePath - Path to test definition file
 * @returns Test ID if present, null otherwise
 */
export async function extractTestId(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    if (filePath.endsWith('.json')) {
      const parsed = JSON.parse(content) as TestDefinition;
      return parsed.id || null;
    }

    // Parse YAML
    const parsed = yaml.parse(content) as TestDefinition;
    return parsed.id || null;
  } catch {
    return null;
  }
}

/**
 * Check if a test definition file has a cloud ID
 *
 * @param filePath - Path to test definition file
 * @returns True if file has an ID field
 */
export async function hasTestId(filePath: string): Promise<boolean> {
  const id = await extractTestId(filePath);
  return id !== null;
}

/**
 * Remove ID from a test definition file (for creating new tests)
 *
 * @param filePath - Path to YAML test definition file
 * @returns True if ID was removed, false if no ID present
 */
export async function removeTestId(filePath: string): Promise<boolean> {
  // Only process YAML files
  if (!filePath.match(/\.(yaml|yml)$/)) {
    return false;
  }

  const content = await fs.readFile(filePath, 'utf-8');
  const doc = yaml.parseDocument(content);

  if (!doc.has('id')) {
    return false;
  }

  doc.delete('id');

  const output = doc.toString();
  await fs.writeFile(filePath, output, 'utf-8');

  return true;
}
