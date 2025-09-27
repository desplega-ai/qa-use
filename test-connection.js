// Test script to verify Playwright connection through localtunnel
const { chromium } = require('playwright');

async function testConnection() {
  console.log('🧪 Testing Playwright connection...');

  // This would be replaced with the actual tunnel WebSocket URL
  const wsUrl = process.argv[2];

  if (!wsUrl) {
    console.error('❌ Please provide WebSocket URL as argument');
    console.log('Usage: node test-connection.js "wss://example.loca.lt/ws/browser/..."');
    process.exit(1);
  }

  console.log(`Connecting to: ${wsUrl}`);

  try {
    const browser = await chromium.connect(wsUrl, {
      headers: {
        'bypass-tunnel-reminder': 'true'
      }
    });

    console.log('✅ Connected successfully!');

    // Test basic functionality
    const page = await browser.newPage();
    await page.goto('https://example.com');
    const title = await page.title();

    console.log(`📄 Page title: ${title}`);

    await page.close();
    await browser.close();

    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Connection failed:');
    console.error(error.message);
    process.exit(1);
  }
}

testConnection();