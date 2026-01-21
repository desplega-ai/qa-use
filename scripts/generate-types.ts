#!/usr/bin/env tsx

import { compile } from 'json-schema-to-typescript';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { getEnv } from '../lib/env/index.js';

interface GenerateTypesOptions {
  apiUrl?: string;
  apiKey?: string;
  outputPath?: string;
}

async function generateTypes(options: GenerateTypesOptions = {}): Promise<void> {
  const apiUrl = options.apiUrl || getEnv('QA_USE_API_URL') || 'https://api.desplega.ai';
  const apiKey = options.apiKey || getEnv('QA_USE_API_KEY');
  const outputPath =
    options.outputPath || path.join(process.cwd(), 'src/types/test-definition.ts');

  console.log('🔍 Fetching JSON Schema from API...');
  console.log(`   API URL: ${apiUrl}/vibe-qa/cli/schema`);

  try {
    const response = await axios.get(`${apiUrl}/vibe-qa/cli/schema`, {
      headers: apiKey
        ? {
            Authorization: `Bearer ${apiKey}`,
          }
        : {},
    });

    const schema = response.data;

    console.log('✓ Schema fetched successfully');
    console.log('📝 Generating TypeScript types...');

    // Generate types from the schema
    const ts = await compile(schema, 'TestDefinitionSchema', {
      bannerComment: `/**
 * Auto-generated TypeScript types for Test CLI definitions
 *
 * DO NOT EDIT MANUALLY - Generated from API schema
 * Run 'pnpm generate:types' to regenerate
 *
 * Source: ${apiUrl}/vibe-qa/cli/schema
 * Generated: ${new Date().toISOString()}
 */`,
      style: {
        semi: true,
        singleQuote: true,
        trailingComma: 'es5',
      },
      unreachableDefinitions: true,
    });

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Write types to file
    await fs.writeFile(outputPath, ts, 'utf-8');

    console.log(`✓ Types generated successfully`);
    console.log(`   Output: ${outputPath}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const errorData = error.response?.data;

      console.error('❌ Failed to fetch schema from API');
      console.error(`   HTTP ${statusCode}: ${errorData?.message || error.message}`);

      if (statusCode === 401 || statusCode === 403) {
        console.error('\n💡 Tip: Set QA_USE_API_KEY environment variable');
      }
    } else {
      console.error('❌ Error generating types:', error);
    }

    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTypes().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export { generateTypes };
