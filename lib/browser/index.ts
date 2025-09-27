import { chromium } from 'playwright';
import type { BrowserServer, Browser } from 'playwright';
import { spawn } from 'child_process';
import { promisify } from 'util';

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

    // Ensure browsers are installed
    await this.ensureBrowsersInstalled();

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
      if (error.message.includes("Executable doesn't exist")) {
        throw new Error(
          'Chromium browser is not installed. Run with forceInstall=true to install browsers automatically.'
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

  private async ensureBrowsersInstalled(): Promise<void> {
    try {
      // Test if chromium is available by trying to get the executable path
      await chromium.executablePath();
    } catch (error) {
      // Browser not installed, but we'll let the user handle installation
      // through the forceInstall option in the MCP tool
      throw new Error(
        'Chromium browser is not installed. Please install Playwright browsers first.'
      );
    }
  }

  async installPlaywrightBrowsers(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Install browsers using npx playwright install
      const installProcess = spawn('npx', ['playwright', 'install', 'chromium'], {
        stdio: 'pipe',
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      installProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      installProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          console.error('Playwright browsers installed successfully');
          resolve();
        } else {
          reject(new Error(`Browser installation failed: ${stderr || stdout}`));
        }
      });

      installProcess.on('error', (error) => {
        reject(new Error(`Failed to start browser installation: ${error.message}`));
      });
    });
  }

  async checkBrowserInstallation(): Promise<{ installed: boolean; version?: string }> {
    try {
      const executablePath = await chromium.executablePath();
      // If we get here, browser is installed
      return {
        installed: true,
        version: 'installed', // Could get actual version if needed
      };
    } catch (error) {
      return {
        installed: false,
      };
    }
  }
}
