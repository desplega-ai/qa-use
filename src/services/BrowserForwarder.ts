import { chromium } from 'playwright';
import type { BrowserServer } from 'playwright';
import localtunnel from 'localtunnel';
import chalk from 'chalk';
import { URL } from 'url';
import https from 'https';

interface ForwardingSession {
  browserServer: BrowserServer;
  tunnel: localtunnel.Tunnel;
  wsEndpoint: string;
  publicUrl: string;
}

export class BrowserForwarder {
  private session: ForwardingSession | null = null;
  private enableLogging: boolean = false;

  constructor(enableLogging: boolean = false) {
    this.enableLogging = enableLogging;
  }

  private log(message: string, type: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.enableLogging) return;

    switch (type) {
      case 'info':
        console.log(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'error':
        console.error(message);
        break;
    }
  }

  private async getPublicIP(): Promise<string> {
    return new Promise((resolve, _reject) => {
      https
        .get('https://api.ipify.org', (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data.trim()));
        })
        .on('error', (_err) => {
          this.log(chalk.gray('Could not fetch public IP'));
          resolve('unknown');
        });
    });
  }

  getConnectionExamples(): string {
    if (!this.session) return '';

    // Get the full WebSocket URL with the proper path
    const localWsUrl = new URL(this.session.wsEndpoint);
    const wsPath = localWsUrl.pathname;
    const tunnelWsUrl =
      this.session.publicUrl.replace('https://', 'wss://').replace('http://', 'ws://') + wsPath;

    return `
${chalk.yellow('Connection Examples:')}

${chalk.gray('Playwright (Python):')}
${chalk.cyan(`from playwright.async_api import async_playwright

async with async_playwright() as p:
    browser = await p.chromium.connect('${tunnelWsUrl}', headers={
        'bypass-tunnel-reminder': 'true'
    })`)}

${chalk.gray('Playwright (Node.js):')}
${chalk.cyan(`const { chromium } = require('playwright');
const browser = await chromium.connect('${tunnelWsUrl}', {
  headers: { 'bypass-tunnel-reminder': 'true' }
});`)}

${chalk.gray('WebSocket (Raw):')}
${chalk.cyan(`const ws = new WebSocket('${tunnelWsUrl}', [], {
  headers: { 'bypass-tunnel-reminder': 'true' }
});`)}

${chalk.gray('cURL test:')}
${chalk.cyan(`curl -H "bypass-tunnel-reminder: true" \\
     -H "Upgrade: websocket" \\
     -H "Connection: Upgrade" \\
     "${tunnelWsUrl}"`)}

${chalk.yellow('URLs:')}
${chalk.gray(`Local:  ${this.session.wsEndpoint}`)}
${chalk.gray(`Public: ${tunnelWsUrl}`)}

${chalk.yellow('Note:')} Make sure to use the full WebSocket URL with the CDP path.
${chalk.gray('Playwright version 1.11+ required for header support.')}
`;
  }

  async start(): Promise<ForwardingSession> {
    if (this.session) {
      throw new Error('Forwarding session already active');
    }

    this.log(chalk.blue('🚀 Starting browser server...'));

    // Launch browser server
    const browserServer = await chromium.launchServer({
      headless: false, // Set to true for headless mode
      args: [
        '--headless=new',
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
        '--remote-debugging-port=0', // Let Playwright choose the port
      ],
    });

    const wsEndpoint = browserServer.wsEndpoint();
    this.log(chalk.gray(`Local WebSocket endpoint: ${wsEndpoint}`));

    // Extract port from WebSocket URL
    const wsUrl = new URL(wsEndpoint);
    const port = parseInt(wsUrl.port);

    this.log(chalk.blue('🌐 Creating public tunnel...'));

    // Create tunnel for the WebSocket endpoint
    const tunnel = await localtunnel({
      port: port,
      subdomain: `qa-use-${Date.now().toString().slice(-6)}`, // Random subdomain
      local_host: 'localhost',
    });

    const publicUrl = tunnel.url;
    console.log(chalk.green(`✅ Browser forwarding active!`));
    console.log(chalk.yellow(`Public URL: ${publicUrl}`));

    // Get and display tunnel password information
    console.log(chalk.yellow(`\n🔐 Tunnel Access Information:`));
    console.log(chalk.gray(`Fetching your public IP for tunnel access...`));

    const publicIP = await this.getPublicIP();

    console.log(chalk.green(`Tunnel Password: ${publicIP}`));
    console.log(chalk.gray(`(This is your current public IP address)`));

    // Get the WebSocket path from the original endpoint
    const wsPath = wsUrl.pathname;
    const tunnelWsUrl =
      publicUrl.replace('https://', 'wss://').replace('http://', 'ws://') + wsPath;

    console.log(chalk.yellow(`\n🌐 WebSocket Connection:`));
    console.log(chalk.cyan(`  Local:  ${wsEndpoint}`));
    console.log(chalk.cyan(`  Public: ${tunnelWsUrl}`));

    console.log(chalk.yellow(`\n🚀 Bypass Tunnel Warning (for programmatic access):`));
    console.log(chalk.gray(`Add these headers to bypass the tunnel reminder page:`));
    console.log(chalk.cyan(`  bypass-tunnel-reminder: true`));
    console.log(chalk.gray(`  OR`));
    console.log(chalk.cyan(`  User-Agent: QA-Use-Bot/1.0`));

    console.log(chalk.yellow(`\n📝 Example Connection Code:`));
    console.log(chalk.gray(`Playwright Python:`));
    console.log(chalk.cyan(`  browser = await p.chromium.connect('${tunnelWsUrl}', headers={`));
    console.log(chalk.cyan(`      'bypass-tunnel-reminder': 'true'`));
    console.log(chalk.cyan(`  })`));

    console.log(chalk.gray(`\nPlaywright Node.js:`));
    console.log(chalk.cyan(`  const browser = await chromium.connect('${tunnelWsUrl}', {`));
    console.log(chalk.cyan(`    headers: { 'bypass-tunnel-reminder': 'true' }`));
    console.log(chalk.cyan(`  });`));

    console.log(chalk.yellow(`\n🌍 Browser Access:`));
    console.log(chalk.gray(`For browser access, visit: ${publicUrl}`));
    console.log(chalk.gray(`Enter password: ${publicIP} when prompted`));

    this.session = {
      browserServer,
      tunnel,
      wsEndpoint,
      publicUrl,
    };

    // Handle tunnel close events
    tunnel.on('close', () => {
      console.log(chalk.yellow('🔌 Tunnel disconnected'));
    });

    tunnel.on('error', (err: Error) => {
      console.error(chalk.red('❌ Tunnel error:'), err.message);
    });

    return this.session;
  }

  async stop(): Promise<void> {
    if (!this.session) {
      console.log(chalk.yellow('No active forwarding session'));
      return;
    }

    console.log(chalk.blue('🛑 Stopping forwarding session...'));

    const session = this.session;
    this.session = null; // Clear session first to prevent multiple stops

    try {
      // Close tunnel quietly
      try {
        session.tunnel.close();
        console.log(chalk.gray('Tunnel closed'));
      } catch {
        console.log(chalk.gray('Tunnel already closed'));
      }

      // Close browser server quietly
      try {
        await session.browserServer.close();
        console.log(chalk.gray('Browser server closed'));
      } catch {
        console.log(chalk.gray('Browser server already closed'));
      }

      console.log(chalk.green('✅ Forwarding session stopped'));
    } catch {
      console.log(chalk.gray('Session cleanup completed'));
    }
  }

  getStatus(): ForwardingSession | null {
    return this.session;
  }

  isActive(): boolean {
    return this.session !== null;
  }

  async waitForConnection(): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    console.log(chalk.blue('\n🔄 Waiting for browser connection...'));

    // Get the full WebSocket URL with CDP path
    const localWsUrl = new URL(this.session.wsEndpoint);
    const wsPath = localWsUrl.pathname;
    const tunnelWsUrl =
      this.session.publicUrl.replace('https://', 'wss://').replace('http://', 'ws://') + wsPath;

    console.log(chalk.gray('WebSocket URL:'));
    console.log(chalk.cyan(`  ${tunnelWsUrl}`));
    console.log(chalk.gray('\nFor programmatic access, use bypass headers:'));
    console.log(chalk.cyan(`  bypass-tunnel-reminder: true`));
    console.log(chalk.gray('\nPress Ctrl+C to stop forwarding'));

    // Keep the process alive
    return new Promise((resolve) => {
      let cleanupCalled = false;

      const cleanup = async () => {
        if (cleanupCalled) return;
        cleanupCalled = true;

        console.log(chalk.yellow('\n🛑 Shutting down...'));

        try {
          await this.stop();
        } catch {
          // Silently handle cleanup errors
        }

        resolve();
      };

      // Handle graceful shutdown
      const handleSignal = () => {
        cleanup();
      };

      process.once('SIGINT', handleSignal);
      process.once('SIGTERM', handleSignal);

      // Also handle tunnel close
      if (this.session) {
        this.session.tunnel.on('close', () => {
          console.log(chalk.yellow('Tunnel closed, stopping session...'));
          cleanup();
        });

        this.session.tunnel.on('error', (_err: Error) => {
          console.log(chalk.red('Tunnel error, stopping session...'));
          cleanup();
        });
      }
    });
  }

  /**
   * Get the WebSocket URL for connecting to the browser
   */
  getWebSocketUrl(): string | null {
    if (!this.session) return null;

    // Get the full WebSocket URL with the proper path
    const localWsUrl = new URL(this.session.wsEndpoint);
    const wsPath = localWsUrl.pathname;
    return (
      this.session.publicUrl.replace('https://', 'wss://').replace('http://', 'ws://') + wsPath
    );
  }
}
