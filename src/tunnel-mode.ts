/**
 * Tunnel Mode
 * Runs a persistent WebSocket tunnel that allows the backend to initiate tasks
 * using the local browser connection.
 */

import { BrowserManager } from '../lib/browser/index.js';
import { TunnelManager } from '../lib/tunnel/index.js';
import { ApiClient } from '../lib/api/index.js';

interface TunnelModeOptions {
  headless?: boolean;
  heartbeatInterval?: number; // in milliseconds
}

export async function startTunnelMode(options: TunnelModeOptions = {}): Promise<void> {
  const { headless = true, heartbeatInterval = 5000 } = options;

  console.log('');
  console.log('🔧 QA-Use Tunnel Mode');
  console.log('====================');
  console.log(`Mode: ${headless ? 'Headless' : 'Visible Browser'}`);
  console.log('');

  // Step 1: Check API key
  const apiClient = new ApiClient();
  const apiKey = apiClient.getApiKey();

  if (!apiKey) {
    console.error('❌ Error: No API key found');
    console.error('');
    console.error('Please set the QA_USE_API_KEY environment variable:');
    console.error('  export QA_USE_API_KEY=your-api-key');
    console.error('');
    process.exit(1);
  }

  console.log('🔑 Validating API key...');

  // Step 2: Validate API key
  const authResult = await apiClient.validateApiKey();
  if (!authResult.success) {
    console.error(`❌ API key validation failed: ${authResult.message}`);
    console.error('');
    process.exit(1);
  }

  console.log('✅ API key valid');
  console.log('');

  // Step 3: Start browser
  console.log('🌐 Starting browser tunnel...');
  const browser = new BrowserManager();

  let browserResult;
  try {
    browserResult = await browser.startBrowser({ headless });
  } catch (error) {
    console.error(`❌ Failed to start browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('');
    process.exit(1);
  }

  const wsEndpoint = browserResult.wsEndpoint;
  console.log('✅ Browser started');

  // Step 4: Start tunnel
  const tunnel = new TunnelManager();
  const wsUrl = new URL(wsEndpoint);
  const browserPort = parseInt(wsUrl.port);

  try {
    await tunnel.startTunnel(browserPort);
  } catch (error) {
    console.error(`❌ Failed to start tunnel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    await browser.stopBrowser();
    console.error('');
    process.exit(1);
  }

  console.log('✅ Tunnel created');
  console.log('');

  // Step 5: Get tunneled WebSocket URL
  const localWsUrl = browser.getWebSocketEndpoint();
  if (!localWsUrl) {
    console.error('❌ Failed to get browser WebSocket endpoint');
    await tunnel.stopTunnel();
    await browser.stopBrowser();
    console.error('');
    process.exit(1);
  }

  const tunneledWsUrl = tunnel.getWebSocketUrl(localWsUrl);
  if (!tunneledWsUrl) {
    console.error('❌ Failed to create tunneled WebSocket URL');
    await tunnel.stopTunnel();
    await browser.stopBrowser();
    console.error('');
    process.exit(1);
  }

  console.log('📡 WebSocket URL:', tunneledWsUrl);
  console.log('');

  // Step 6: Send initial ws-url to backend
  console.log('📤 Registering with backend...');
  const initialResult = await apiClient.setWsUrl(tunneledWsUrl);
  if (!initialResult.success) {
    console.error(`❌ Failed to register with backend: ${initialResult.message}`);
    await tunnel.stopTunnel();
    await browser.stopBrowser();
    console.error('');
    process.exit(1);
  }

  console.log('✅ Registered with backend');
  console.log('');

  // Step 7: Set up heartbeat
  console.log(`🔄 Heartbeat active (every ${heartbeatInterval / 1000}s)`);
  console.log('   Press Ctrl+C to stop');
  console.log('');

  let heartbeatCount = 0;
  const heartbeatIntervalId = setInterval(async () => {
    try {
      const result = await apiClient.setWsUrl(tunneledWsUrl);
      heartbeatCount++;
      const timestamp = new Date().toLocaleTimeString();
      if (result.success) {
        console.log(`[${timestamp}] ✓ Heartbeat #${heartbeatCount} sent`);
      } else {
        console.log(`[${timestamp}] ⚠ Heartbeat #${heartbeatCount} warning: ${result.message}`);
      }
    } catch (error) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(
        `[${timestamp}] ⚠ Heartbeat #${heartbeatCount + 1} error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, heartbeatInterval);

  // Step 8: Set up graceful shutdown
  const cleanup = async () => {
    console.log('');
    console.log('');
    console.log('🛑 Shutting down tunnel...');

    // Stop heartbeat
    clearInterval(heartbeatIntervalId);
    console.log('✅ Heartbeat stopped');

    // Stop tunnel
    try {
      await tunnel.stopTunnel();
      console.log('✅ Tunnel closed');
    } catch (error) {
      console.log('⚠ Tunnel cleanup warning:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Stop browser
    try {
      await browser.stopBrowser();
      console.log('✅ Browser closed');
    } catch (error) {
      console.log('⚠ Browser cleanup warning:', error instanceof Error ? error.message : 'Unknown error');
    }

    console.log('');
    console.log('👋 Tunnel mode stopped');
    console.log('');
    process.exit(0);
  };

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', cleanup);

  // Handle SIGTERM
  process.on('SIGTERM', cleanup);

  // Keep the process running
  // The interval and signal handlers will keep it alive
}
