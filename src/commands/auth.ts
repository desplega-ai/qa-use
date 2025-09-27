import { Command } from 'commander';
import { input } from '@inquirer/prompts';
import { AuthService } from '../services/AuthService.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.qa-use');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
  apiKey?: string;
  email?: string;
}

function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {
    // Config doesn't exist or is invalid
  }
  return {};
}

function saveConfig(config: Config): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(`Failed to save config: ${error instanceof Error ? error.message : error}`);
  }
}

export function createAuthCommand() {
  const auth = new Command('auth');

  auth
    .description('Authenticate with the QA service')
    .option('--reset', 'Reset authentication and register again')
    .option('--api-key <key>', 'Set API key directly')
    .action(async (options) => {
      const chalk = (await import('chalk')).default;
      const authService = new AuthService();

      try {
        const config = loadConfig();

        // Default behavior: check existing auth if present
        if (!options.reset && !options.apiKey && config.apiKey) {
          console.log(chalk.blue('🔍 Checking authentication...'));
          const result = await authService.check(config.apiKey);

          if (result.success) {
            console.log(chalk.green('✅ Authentication valid'));
            console.log(chalk.gray(`Email: ${config.email || 'Unknown'}`));
            console.log(chalk.gray('Use --reset to re-authenticate'));
          } else {
            console.log(chalk.red('❌ Authentication failed'));
            console.log(chalk.gray(result.message || 'Invalid API key'));
            console.log(chalk.yellow('Use --reset to register again'));
          }
          return;
        }

        if (options.apiKey) {
          console.log(chalk.blue('🔑 Setting API key...'));
          const result = await authService.check(options.apiKey);

          if (result.success) {
            config.apiKey = options.apiKey;
            saveConfig(config);
            console.log(chalk.green('✅ API key set and validated'));
          } else {
            console.log(chalk.red('❌ Invalid API key'));
            console.log(chalk.gray(result.message || 'API key validation failed'));
          }
          return;
        }

        // Register new user (or reset existing)
        if (options.reset && config.apiKey) {
          console.log(chalk.yellow('🔄 Resetting authentication...'));
        } else {
          console.log(chalk.blue('🔐 QA-USE Authentication'));
        }
        console.log(chalk.gray('Enter your email to register and receive an API key'));

        const email = await input({
          message: 'Email address:',
          validate: (input) => {
            if (!input || !input.includes('@')) {
              return 'Please enter a valid email address';
            }
            return true;
          },
        });

        console.log(chalk.blue('📧 Registering...'));
        const result = await authService.register(email);

        if (result.success && result.apiKey) {
          config.email = email;
          config.apiKey = result.apiKey;
          saveConfig(config);

          console.log(chalk.green('✅ Registration successful!'));
          console.log(chalk.yellow('🔑 API Key received and saved'));
          console.log(chalk.gray(`Config saved to: ${CONFIG_FILE}`));
        } else {
          console.log(chalk.red('❌ Registration failed'));
          console.log(chalk.gray(result.message || 'Unknown error'));
        }
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return auth;
}
