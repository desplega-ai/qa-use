import { fork } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Browser, BrowserServer } from 'playwright';
import { chromium } from 'playwright';

export interface BrowserInstallationStatus {
  installed: boolean;
  executablePath: string | null;
  error?: string;
}

export interface BrowserSession {
  browserServer: BrowserServer;
  wsEndpoint: string;
  isActive: boolean;
}

export interface BrowserOptions {
  headless?: boolean;
  devtools?: boolean;
  args?: string[];
  userDataDir?: string;
  isolated?: boolean;
}

export class BrowserManager {
  private session: BrowserSession | null = null;

  async startBrowser(options: BrowserOptions = {}): Promise<BrowserSession> {
    if (this.session) {
      throw new Error('Browser session already active');
    }

    const defaultArgs = [
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--mute-audio',
      '--disable-extensions',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--disable-3d-apis',
      '--remote-debugging-port=0',
    ];

    try {
      const browserServer = await chromium.launchServer({
        headless: options.headless ?? true,
        devtools: options.devtools ?? false,
        args: [...defaultArgs, ...(options.args || [])],
        handleSIGINT: false,
        handleSIGTERM: false,
      });

      const wsEndpoint = browserServer.wsEndpoint();

      this.session = {
        browserServer,
        wsEndpoint,
        isActive: true,
      };

      return this.session;
    } catch (error: any) {
      if (
        error.message.includes("Executable doesn't exist") ||
        error.message.includes('browserType.launch')
      ) {
        throw new Error(
          'Chromium browser is not installed. Please run ensure_installed to install browsers.'
        );
      }
      throw error;
    }
  }

  async stopBrowser(): Promise<void> {
    if (!this.session) {
      return;
    }

    const session = this.session;
    this.session = null;

    try {
      await session.browserServer.close();
    } catch {
      // Silently handle cleanup errors
    }
  }

  async connectToBrowser(): Promise<Browser | null> {
    if (!this.session) {
      return null;
    }

    try {
      return await chromium.connect(this.session.wsEndpoint);
    } catch {
      return null;
    }
  }

  getSession(): BrowserSession | null {
    return this.session;
  }

  isActive(): boolean {
    return this.session?.isActive ?? false;
  }

  /**
   * Check if browser is actually alive by attempting to connect
   */
  async checkHealth(): Promise<boolean> {
    if (!this.session) return false;

    try {
      const browser = await chromium.connect(this.session.wsEndpoint, {
        timeout: 5000, // 5 second timeout
      });
      await browser.close();
      return true;
    } catch {
      this.session.isActive = false;
      return false;
    }
  }

  getWebSocketEndpoint(): string | null {
    return this.session?.wsEndpoint ?? null;
  }

  async installPlaywrightBrowsers(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Use the LOCAL playwright installation from package.json
        // This ensures consistency between install and launch
        // Create require function for ES modules
        const require = createRequire(import.meta.url);
        const playwrightPackagePath = require.resolve('playwright/package.json');
        const cliPath = path.join(path.dirname(playwrightPackagePath), 'cli.js');

        console.error(`Installing browsers using local Playwright at: ${cliPath}`);

        // Fork the local Playwright CLI to install chromium
        const child = fork(cliPath, ['install', 'chromium'], {
          stdio: 'pipe',
        });

        const output: string[] = [];

        child.stdout?.on('data', (data) => {
          const message = data.toString();
          output.push(message);
          console.error(message); // Log progress to stderr
        });

        child.stderr?.on('data', (data) => {
          const message = data.toString();
          output.push(message);
          console.error(message); // Log errors to stderr
        });

        child.on('close', (code) => {
          if (code === 0) {
            console.error('✅ Playwright browsers installed successfully');
            resolve();
          } else {
            reject(new Error(`Failed to install browser: ${output.join('')}`));
          }
        });

        child.on('error', (error) => {
          reject(new Error(`Failed to start browser installation: ${error.message}`));
        });
      } catch (error: any) {
        reject(new Error(`Failed to locate Playwright CLI: ${error.message}`));
      }
    });
  }

  /**
   * Check if Playwright Chromium browser is installed without launching it.
   * This is a fast, cheap check that verifies the executable file exists.
   */
  checkBrowsersInstalled(): BrowserInstallationStatus {
    try {
      const executablePath = chromium.executablePath();

      // Check if the executable file actually exists
      if (fs.existsSync(executablePath)) {
        return {
          installed: true,
          executablePath,
        };
      }

      return {
        installed: false,
        executablePath: null,
        error: `Chromium executable not found at expected path: ${executablePath}`,
      };
    } catch (error: any) {
      return {
        installed: false,
        executablePath: null,
        error: error.message,
      };
    }
  }
}
