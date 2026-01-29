/**
 * qa-use install-deps - Install Playwright browser dependencies
 */

import { Command } from 'commander';
import { BrowserManager } from '../../../lib/browser/index.js';
import { error, info, success } from '../lib/output.js';

export const installDepsCommand = new Command('install-deps')
  .description('Install Playwright browser dependencies (Chromium)')
  .option('--force', 'Force reinstall even if browsers are already installed')
  .action(async (options: { force?: boolean }) => {
    const browser = new BrowserManager();

    // Check current installation status unless --force
    if (!options.force) {
      const status = browser.checkBrowsersInstalled();
      if (status.installed) {
        console.log(success('Playwright browsers are already installed'));
        console.log(`  Path: ${status.executablePath}`);
        console.log('');
        console.log(info('Use --force to reinstall'));
        return;
      }
    }

    console.log(info('Installing Playwright Chromium browser...'));
    console.log('');

    try {
      await browser.installPlaywrightBrowsers();

      // Verify installation
      const status = browser.checkBrowsersInstalled();
      if (status.installed) {
        console.log('');
        console.log(success('Playwright browsers installed successfully'));
        console.log(`  Path: ${status.executablePath}`);
      } else {
        console.log('');
        console.log(error('Installation verification failed'));
        if (status.error) {
          console.log(`  ${status.error}`);
        }
        process.exit(1);
      }
    } catch (err) {
      console.log('');
      console.log(error('Failed to install Playwright browsers'));
      if (err instanceof Error) {
        console.log(`  ${err.message}`);
      }
      process.exit(1);
    }
  });
