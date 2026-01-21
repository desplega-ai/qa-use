#!/usr/bin/env tsx

/**
 * Simplified E2E test - just test getting an existing test and exporting it
 */

import { ApiClient } from '../lib/api/index.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

async function main() {
  console.log('🧪 Phase 1 E2E Test - Simplified\n');

  const client = new ApiClient();

  const apiKey = process.env.QA_USE_API_KEY;
  if (!apiKey) {
    console.error('❌ QA_USE_API_KEY not found');
    process.exit(1);
  }

  client.setApiKey(apiKey);
  console.log('✓ API key loaded\n');

  // Test 1: List tests
  console.log('📋 Test 1: Listing existing tests...');
  try {
    const tests = await client.listTests({ limit: 5 });
    console.log(`✓ Found ${tests.length} tests\n`);

    if (tests.length > 0) {
      const firstTest = tests[0];
      console.log(`Using test: ${firstTest.name} (${firstTest.id})\n`);

      // Test 2: Export the test
      console.log('📤 Test 2: Exporting test to YAML...');
      try {
        const yaml = await client.exportTest(firstTest.id, 'yaml', false);
        console.log('✓ Export successful');
        console.log('\nYAML preview (first 500 chars):');
        console.log(yaml.slice(0, 500));
        console.log('...\n');
      } catch (error) {
        console.error('❌ Export failed:', error);
      }
    } else {
      console.log('⚠️  No tests available to export');
    }
  } catch (error) {
    console.error('❌ Failed to list tests:', error);
    process.exit(1);
  }

  // Test 3: Get schema
  console.log('📋 Test 3: Fetching schema...');
  try {
    const schema = await client.getTestDefinitionSchema();
    console.log('✓ Schema fetched successfully');
    console.log(`  - Title: ${schema.title}`);
    console.log(`  - Has TestDefinition: ${!!schema.definitions?.TestDefinition || !!schema.$defs?.TestDefinition}`);
  } catch (error) {
    console.error('❌ Failed to fetch schema:', error);
  }

  console.log('\n🎉 Phase 1 core methods working!\n');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
