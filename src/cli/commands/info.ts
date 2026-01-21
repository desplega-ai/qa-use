/**
 * qa-use info - Show current configuration
 */

import { Command } from 'commander';
import { loadConfig, configExists } from '../lib/config.js';
import { warning } from '../lib/output.js';

export const infoCommand = new Command('info')
  .description('Show current configuration and environment')
  .action(async () => {
    console.log('ℹ️  QA-Use Configuration\n');

    const hasConfig = await configExists();

    if (!hasConfig) {
      console.log(warning('No configuration file found'));
      console.log('  Run `qa-use setup` to create one\n');
    }

    const config = await loadConfig();

    console.log('Configuration:');
    console.log(`  API Key: ${config.api_key ? config.api_key.slice(0, 8) + '...' : '(not set)'}`);
    console.log(
      `  API URL: ${config.api_url || process.env.QA_USE_API_URL || 'https://api.desplega.ai'}`
    );
    console.log(`  Test Directory: ${config.test_directory || './qa-tests'}`);
    console.log(`  Default App Config: ${config.default_app_config_id || '(not set)'}`);

    console.log('\nDefaults:');
    console.log(`  Headless: ${config.defaults?.headless ?? true}`);
    console.log(`  Persist: ${config.defaults?.persist ?? false}`);
    console.log(`  Timeout: ${config.defaults?.timeout ?? 300}s`);
    console.log(`  Allow Fix: ${config.defaults?.allow_fix ?? true}`);

    console.log('\nEnvironment Variables:');
    console.log(`  QA_USE_API_KEY: ${process.env.QA_USE_API_KEY ? 'Set' : 'Not set'}`);
    console.log(`  QA_USE_API_URL: ${process.env.QA_USE_API_URL || 'Not set'}`);
    console.log(`  QA_USE_REGION: ${process.env.QA_USE_REGION || 'Not set'}`);
  });
