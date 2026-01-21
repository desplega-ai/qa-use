/**
 * Test execution runner with SSE progress output
 */

import {
  ApiClient,
  type RunCliTestOptions,
  type RunCliTestResult,
} from '../../../lib/api/index.js';
import type { SSEEvent } from '../../../lib/api/sse.js';
import { printSSEProgress } from './output.js';

/**
 * Run a test with real-time progress output
 *
 * @param client - ApiClient instance
 * @param options - Test run options
 * @param onEvent - Optional additional event callback
 * @returns Test result
 */
export async function runTest(
  client: ApiClient,
  options: RunCliTestOptions,
  onEvent?: (event: SSEEvent) => void
): Promise<RunCliTestResult> {
  return await client.runCliTest(options, (event) => {
    // Print progress to console
    printSSEProgress(event);

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
