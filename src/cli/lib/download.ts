/**
 * Download utilities for saving test assets locally
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';

/**
 * Generate short hash from file path for deterministic directory naming
 */
function hashFilePath(filePath: string): string {
  return crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 8);
}

/**
 * Download a file from URL to local path
 */
export async function downloadFile(url: string, destPath: string): Promise<void> {
  // Create directory if it doesn't exist
  const dir = path.dirname(destPath);
  fs.mkdirSync(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        const fileStream = fs.createWriteStream(destPath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {}); // Delete partial file
          reject(err);
        });
      })
      .on('error', reject);
  });
}

/**
 * Get file extension from URL (e.g., .jpeg, .webm, .har)
 */
export function getExtensionFromUrl(url: string): string {
  // Remove query params
  const urlWithoutQuery = url.split('?')[0];
  const ext = path.extname(urlWithoutQuery);
  return ext || '.bin';
}

/**
 * Build download path for a test asset
 */
export function buildDownloadPath(
  baseDir: string,
  testId: string | undefined,
  runId: string,
  assetType: 'screenshot' | 'recording' | 'har',
  fileName: string,
  sourceFile?: string
): string {
  let testDir: string;
  if (testId) {
    testDir = testId;
  } else if (sourceFile) {
    testDir = `local-${hashFilePath(sourceFile)}`;
  } else {
    testDir = 'unknown-test';
  }
  return path.join(baseDir, testDir, runId, assetType + 's', fileName);
}

/**
 * Download assets (recording, HAR) from test result
 */
export async function downloadAssets(
  assets: { recording_url?: string; har_url?: string },
  baseDir: string,
  testId: string | undefined,
  runId: string,
  sourceFile?: string
): Promise<Array<{ type: string; path: string }>> {
  const downloaded: Array<{ type: string; path: string }> = [];

  if (assets.recording_url) {
    try {
      const ext = getExtensionFromUrl(assets.recording_url);
      const fileName = `recording${ext}`;
      const destPath = buildDownloadPath(baseDir, testId, runId, 'recording', fileName, sourceFile);
      await downloadFile(assets.recording_url, destPath);
      downloaded.push({ type: 'Recording', path: destPath });
    } catch (err: any) {
      console.error(`Failed to download recording: ${err.message}`);
    }
  }

  if (assets.har_url) {
    try {
      const ext = getExtensionFromUrl(assets.har_url);
      const fileName = `network${ext}`;
      const destPath = buildDownloadPath(baseDir, testId, runId, 'har', fileName, sourceFile);
      await downloadFile(assets.har_url, destPath);
      downloaded.push({ type: 'HAR', path: destPath });
    } catch (err: any) {
      console.error(`Failed to download HAR: ${err.message}`);
    }
  }

  return downloaded;
}
