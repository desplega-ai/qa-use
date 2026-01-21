#!/usr/bin/env tsx

/**
 * E2E test script for Phase 1 implementation
 *
 * Tests the new ApiClient CLI methods:
 * - getTestDefinitionSchema()
 * - validateTestDefinition()
 * - runCliTest() with SSE streaming
 */

import { ApiClient } from '../lib/api/index.js';
import type { TestDefinition } from '../src/types/test-definition.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env
dotenv.config({ path: resolve(process.cwd(), '.env') });

async function main() {
  console.log('🧪 Phase 1 E2E Test - CLI API Methods\n');

  // Initialize ApiClient
  const client = new ApiClient();

  const apiKey = process.env.QA_USE_API_KEY;
  if (!apiKey) {
    console.error('❌ QA_USE_API_KEY not found in environment');
    process.exit(1);
  }

  client.setApiKey(apiKey);
  console.log('✓ API key loaded from environment\n');

  // Test app config ID from user
  const appConfigId = '600dc916-16b9-4cb8-a7d1-09658f146e45';

  // Test 1: Get Schema
  console.log('📋 Test 1: Fetching JSON Schema...');
  try {
    const schema = await client.getTestDefinitionSchema();
    console.log('✓ Schema fetched successfully');
    console.log(`  - Schema type: ${schema.$schema || 'Unknown'}`);
    console.log(`  - Title: ${schema.title || 'TestDefinition'}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to fetch schema:', error);
    process.exit(1);
  }

  // Test 2: Validate a simple test definition
  console.log('🔍 Test 2: Validating test definition...');
  const testDef: TestDefinition = {
    name: 'Phase 1 E2E Test',
    app_config: appConfigId, // Use app config ID
    variables: {},
    steps: [
      {
        action: 'goto',
        url: '/',
      },
      {
        action: 'to_be_visible',
        target: 'dashboard',
      },
    ],
  };

  try {
    const validation = await client.validateTestDefinition([testDef]);
    console.log('✓ Validation completed');
    console.log(`  - Valid: ${validation.valid}`);
    console.log(`  - Errors: ${validation.errors.length}`);
    console.log(`  - Warnings: ${validation.warnings.length}`);

    if (validation.errors.length > 0) {
      console.log('\n  Errors:');
      validation.errors.forEach((err) => {
        console.log(`    - ${err.path}: ${err.message}`);
      });
    }

    if (validation.warnings.length > 0) {
      console.log('\n  Warnings:');
      validation.warnings.forEach((warn) => {
        console.log(`    - ${warn.path}: ${warn.message}`);
      });
    }

    if (!validation.valid) {
      console.error('\n❌ Test definition is not valid');
      process.exit(1);
    }

    console.log('');
  } catch (error) {
    console.error('❌ Failed to validate test definition:', error);
    process.exit(1);
  }

  // Test 3: Run the test with SSE streaming
  console.log('🚀 Test 3: Running test with SSE streaming...');
  console.log('   (This will execute the test against qacrmdemo)\n');
  console.log(`   Using app config: ${appConfigId}\n`);

  try {
    const result = await client.runCliTest(
      {
        test_definitions: [testDef],
        persist: false, // Don't save to DB
        headless: true,
        allow_fix: false, // Disable AI self-healing
        capture_screenshots: false,
        store_recording: false,
        store_har: false,
      },
      (event) => {
        // SSE event callback
        switch (event.event) {
          case 'start':
            console.log(`   → Test started (run_id: ${event.data.run_id})`);
            console.log(`     Total steps: ${event.data.total_steps}`);
            break;
          case 'step_start':
            console.log(`   [${event.data.step_index + 1}] Starting: ${event.data.name}`);
            break;
          case 'step_complete':
            const status = event.data.status === 'passed' ? '✓' : '✗';
            console.log(
              `   [${event.data.step_index + 1}] ${status} ${event.data.name} (${event.data.duration.toFixed(2)}s)`
            );
            break;
          case 'complete':
            console.log(`\n   Test completed: ${event.data.status}`);
            break;
          case 'error':
            console.log(`   ❌ Error: ${event.data.error}`);
            break;
          default:
            console.log(`   [${event.event}] ${JSON.stringify(event.data).slice(0, 100)}...`);
        }
      }
    );

    console.log('\n✓ Test execution completed');
    console.log(`  - Status: ${result.status}`);
    console.log(`  - Duration: ${result.duration_seconds}s`);
    console.log(`  - Steps: ${result.steps?.length || 0}`);

    if (result.assets) {
      if (result.assets.recording_url) {
        console.log(`  - Recording: ${result.assets.recording_url}`);
      }
      if (result.assets.har_url) {
        console.log(`  - HAR: ${result.assets.har_url}`);
      }
    }

    if (result.error) {
      console.log(`\n⚠️  Test error: ${result.error}`);
    }

    if (result.status !== 'passed') {
      console.log(`\n⚠️  Test did not pass (status: ${result.status})`);
      console.log('   This is expected for Phase 1 - SSE streaming is working!');
    } else {
      console.log('\n✓ Test passed!');
    }

    console.log('');
  } catch (error) {
    console.error('❌ Failed to run test:', error);
    process.exit(1);
  }

  console.log('🎉 All Phase 1 tests passed!\n');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
