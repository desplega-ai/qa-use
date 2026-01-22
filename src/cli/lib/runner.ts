/**
 * Test execution runner with SSE progress output
 */

import {
  ApiClient,
  type RunCliTestOptions,
  type RunCliTestResult,
} from '../../../lib/api/index.js';
import type { SSEEvent } from '../../../lib/api/sse.js';
import { printSSEProgress, type SSEProgressContext } from './output.js';

export interface RunTestOptions {
  verbose?: boolean;
  /** Whether to update local file on test_fixed event */
  updateLocal?: boolean;
  /** Path to the source test definition file */
  sourceFile?: string;
}

/**
 * Run a test with real-time progress output
 *
 * @param client - ApiClient instance
 * @param options - Test run options
 * @param runOptions - Runner options (verbose, etc.)
 * @param onEvent - Optional additional event callback
 * @returns Test result
 */
export async function runTest(
  client: ApiClient,
  options: RunCliTestOptions,
  runOptions: RunTestOptions = {},
  onEvent?: (event: SSEEvent) => void
): Promise<RunCliTestResult> {
  const { verbose = false, updateLocal, sourceFile } = runOptions;

  // Build context for SSE progress handler
  const context: SSEProgressContext | undefined =
    updateLocal || sourceFile ? { updateLocal, sourceFile } : undefined;

  return await client.runCliTest(options, (event) => {
    // Print progress to console
    printSSEProgress(event, verbose, context);

    // Call additional callback if provided
    if (onEvent) {
      onEvent(event);
    }
  });
}

/**
 * Run multiple tests sequentially
 *
 * @param client - ApiClient instance
 * @param tests - Array of test run options
 * @returns Array of test results
 */
export async function runTests(
  client: ApiClient,
  tests: RunCliTestOptions[]
): Promise<RunCliTestResult[]> {
  const results: RunCliTestResult[] = [];

  for (let i = 0; i < tests.length; i++) {
    console.log(`\nRunning test ${i + 1}/${tests.length}...\n`);
    const result = await runTest(client, tests[i]);
    results.push(result);
  }

  return results;
}
