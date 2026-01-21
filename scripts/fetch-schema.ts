#!/usr/bin/env tsx

import { ApiClient } from '../lib/api/index.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const client = new ApiClient();
  const apiKey = process.env.QA_USE_API_KEY;
  if (!apiKey) {
    console.error('❌ QA_USE_API_KEY not found');
    process.exit(1);
  }
  client.setApiKey(apiKey);

  const schema = await client.getTestDefinitionSchema();
  console.log(JSON.stringify(schema, null, 2));
}

main();
