import { chromium } from 'playwright';
import type { BrowserServer, Browser } from 'playwright';
import { fork } from 'child_process';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

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
    } catch (error) {
      // Silently handle cleanup errors
    }
  }

  async connectToBrowser(): Promise<Browser | null> {
    if (!this.session) {
      return null;
    }

    try {
      return await chromium.connect(this.session.wsEndpoint);
    } catch (error) {
      return null;
    }
  }

  getSession(): BrowserSession | null {
    return this.session;
  }

  isActive(): boolean {
    return this.session?.isActive ?? false;
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
}
