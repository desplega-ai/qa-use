/**
 * qa-use info - Show current configuration and app config details
 */

import { Command } from 'commander';
import { loadConfig, configExists } from '../lib/config.js';
import { success, error, warning } from '../lib/output.js';
import { ApiClient } from '../../../lib/api/index.js';
import type { AppConfig } from '../../../lib/api/index.js';
import { getEnvWithSource } from '../../../lib/env/index.js';

/**
 * Mask a sensitive value (show first 10 chars or asterisks)
 */
function maskValue(value: string | undefined | null, showSecrets: boolean): string {
  if (!value) return '(not set)';
  if (showSecrets) return value;
  return '**********';
}

/**
 * Format a value for display, showing (not set) if empty
 */
function formatValue(value: string | undefined | null): string {
  if (!value) return '(not set)';
  return value;
}

export const infoCommand = new Command('info')
  .description('Show current configuration and environment')
  .option('--show-secrets', 'Show sensitive values like login password')
  .action(async (options: { showSecrets?: boolean }) => {
    console.log('QA-Use Configuration\n');

    const hasLocalConfig = await configExists();
    const config = await loadConfig();

    // Determine API key source
    const apiKeyEnvResult = getEnvWithSource('QA_USE_API_KEY');
    const apiKey = config.api_key || apiKeyEnvResult.value;
    let apiKeySource = '';
    if (apiKey) {
      if (apiKeyEnvResult.value && apiKeyEnvResult.source === 'env') {
        apiKeySource = ' (from environment variable)';
      } else if (apiKeyEnvResult.source === 'config') {
        apiKeySource = ' (from ~/.qa-use.json)';
      } else if (config.api_key) {
        apiKeySource = ' (from config file)';
      }
    }

    // Show basic configuration
    console.log('Configuration:');
    console.log(`  API Key: ${apiKey ? apiKey.slice(0, 12) + '...' : '(not set)'}${apiKeySource}`);
    console.log(
      `  API URL: ${config.api_url || process.env.QA_USE_API_URL || 'https://api.desplega.ai'}`
    );
    console.log(`  Test Directory: ${config.test_directory || './qa-tests'}`);

    // Fetch and display app config if API key is available
    let appConfig: AppConfig | null = null;
    let appConfigSource = '';

    if (apiKey) {
      try {
        const client = new ApiClient(config.api_url);
        client.setApiKey(apiKey);

        const authResponse = await client.validateApiKey();

        if (authResponse.success && authResponse.data) {
          const apiKeyAppConfigId = authResponse.data.api_key?.app_config_id;

          // Determine source of app config
          if (config.default_app_config_id) {
            // User explicitly set default_app_config_id
            const envAppConfigId = process.env.QA_USE_DEFAULT_APP_CONFIG_ID;
            if (envAppConfigId === config.default_app_config_id) {
              appConfigSource = '(from QA_USE_DEFAULT_APP_CONFIG_ID)';
            } else {
              appConfigSource = '(from config file)';
            }

            // Check if it differs from API key's config
            if (config.default_app_config_id !== apiKeyAppConfigId) {
              // Fetch the override config
              const configs = await client.listAppConfigs({ limit: 100 });
              const overrideConfig = configs.find((c) => c.id === config.default_app_config_id);
              if (overrideConfig) {
                appConfig = overrideConfig;
              } else {
                console.log(
                  `\n${warning(`App config ${config.default_app_config_id} not found, using API key default`)}`
                );
                appConfig = authResponse.data.app_config || null;
                appConfigSource = '(associated with API key)';
              }
            } else {
              // Same as API key's config, but user explicitly set it
              appConfig = authResponse.data.app_config || null;
            }
          } else {
            // No explicit default_app_config_id set
            appConfig = authResponse.data.app_config || null;
            appConfigSource = '(associated with API key)';
          }
        }
      } catch (err) {
        console.log(`\n${error('Failed to fetch app config')}`);
        if (err instanceof Error) {
          console.log(`  ${err.message}`);
        }
      }
    }

    // Display app config details
    console.log(`\nApp Config: ${appConfigSource}`);
    if (appConfig) {
      console.log(`  ID: ${appConfig.id}`);
      console.log(`  Name: ${appConfig.name}`);
      console.log(`  Base URL: ${formatValue(appConfig.base_url)}`);
      console.log(`  Login URL: ${formatValue(appConfig.login_url)}`);
      console.log(`  Login User: ${formatValue(appConfig.login_username)}`);
      console.log(
        `  Login Pass: ${maskValue(appConfig.login_password, options.showSecrets || false)}${
          appConfig.login_password && !options.showSecrets ? ' (use --show-secrets to reveal)' : ''
        }`
      );
      console.log(`  Viewport: ${appConfig.vp_type || 'desktop'}`);
      console.log(`  Type: ${appConfig.cfg_type || 'production'}`);
      console.log(`  Status: ${appConfig.status}`);
    } else if (!apiKey) {
      console.log('  Unable to fetch (no API key)');
    } else {
      console.log('  No app config found');
    }

    // Show defaults
    console.log('\nDefaults:');
    console.log(`  Headless: ${config.defaults?.headless ?? true}`);
    console.log(`  Persist: ${config.defaults?.persist ?? false}`);
    console.log(`  Timeout: ${config.defaults?.timeout ?? 300}s`);
    console.log(`  Allow Fix: ${config.defaults?.allow_fix ?? true}`);

    // Show test variables if app config is available
    if (appConfig) {
      console.log('\nTest Variables:');
      console.log('  These are automatically available in test definitions:');
      console.log(`  - {{base_url}} -> ${formatValue(appConfig.base_url)}`);
      console.log(`  - {{login_url}} -> ${formatValue(appConfig.login_url)}`);
      console.log(`  - {{login_username}} -> ${formatValue(appConfig.login_username)}`);
      console.log(
        `  - {{login_password}} -> ${maskValue(appConfig.login_password, options.showSecrets || false)}`
      );
    }

    // Show setup status checklist
    console.log('\nSetup Status:');

    // API Key status
    if (apiKey) {
      console.log(success('API Key configured'));
    } else {
      console.log(error('API Key not configured - set QA_USE_API_KEY or run `qa-use setup`'));
    }

    // App Config status
    if (appConfig) {
      console.log(success('App Config available'));
    } else if (!apiKey) {
      console.log(error('App Config unavailable'));
    } else {
      console.log(warning('App Config not found'));
    }

    // Base URL status
    if (appConfig?.base_url) {
      console.log(success('Base URL set (required for CI)'));
    } else if (appConfig) {
      console.log(error('Base URL not set (required for CI)'));
    } else {
      console.log(error('Base URL unknown'));
    }

    // Login credentials status (optional but recommended)
    if (appConfig?.login_username && appConfig?.login_password) {
      console.log(success('Login credentials configured'));
    } else if (appConfig) {
      console.log(warning('Login credentials not configured'));
    }

    // Local config file status
    if (hasLocalConfig) {
      console.log(success('Local config file exists'));
    } else {
      console.log(warning('No local config file - run `qa-use setup`'));
    }
  });
