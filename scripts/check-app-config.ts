#!/usr/bin/env tsx

import { ApiClient } from '../lib/api/index.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const client = new ApiClient();

  const apiKey = process.env.QA_USE_API_KEY;
  if (!apiKey) {
    console.error('❌ QA_USE_API_KEY not found in environment');
    process.exit(1);
  }

  client.setApiKey(apiKey);

  console.log('🔍 Checking available app configs...\n');

  try {
    const configs = await client.listAppConfigs({ limit: 10 });

    console.log(`Found ${configs.length} app configs:\n`);

    for (const config of configs) {
      console.log(`ID: ${config.id}`);
      console.log(`  Name: ${config.name}`);
      console.log(`  Base URL: ${config.base_url}`);
      console.log(`  Type: ${config.cfg_type || 'N/A'}`);
      console.log(`  Status: ${config.status}`);
      console.log('');
    }
  } catch (error) {
    console.error('❌ Failed to list app configs:', error);
    process.exit(1);
  }
}

main();
