#!/usr/bin/env node
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

function findTestFiles(dir, pattern) {
  const results = [];

  function walk(currentDir) {
    try {
      const files = readdirSync(currentDir);
      for (const file of files) {
        const filePath = join(currentDir, file);
        try {
          const stat = statSync(filePath);
          if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
              walk(filePath);
            }
          } else if (file.endsWith(pattern) && (file.includes('.integration.') || file.includes('integration.'))) {
            results.push(filePath);
          }
        } catch (err) {
          // Skip files we can't access
        }
      }
    } catch (err) {
      // Skip directories we can't access
    }
  }

  walk(dir);
  return results;
}

// Find all .test.ts files that include '.integration.' in the name
const testFiles = [
  ...findTestFiles('lib', '.test.ts'),
  ...findTestFiles('src', '.test.ts')
];

if (testFiles.length === 0) {
  console.log('No integration test files found');
  process.exit(0);
}

// Run bun test with the found files
const args = ['test', '--preload', './test-setup.ts', ...testFiles];
const bunTest = spawn('bun', args, { stdio: 'inherit', shell: true });

bunTest.on('close', (code) => {
  process.exit(code);
});
