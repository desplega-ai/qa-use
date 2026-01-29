/**
 * Console output formatting utilities
 */

import * as fs from 'node:fs';
import * as yaml from 'yaml';
import type { SSEEvent } from '../../../lib/api/sse.js';
import { buildDownloadPath, downloadFile, getExtensionFromUrl } from './download.js';

/**
 * Context for SSE progress output, used for features like --update-local and --download
 */
export interface SSEProgressContext {
  /** Whether to update local file on test_fixed event */
  updateLocal?: boolean;
  /** Path to the source test definition file */
  sourceFile?: string;
  /** Whether to download assets locally */
  download?: boolean;
  /** Base directory for downloads (default: /tmp/qa-use/downloads) */
  downloadBaseDir?: string;
  /** Test ID for organizing downloads */
  testId?: string;
  /** Run ID for organizing downloads */
  runId?: string;
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

// Track printed logs per step to avoid duplicates when logs are sent incrementally
const printedLogs = new Map<number, Set<string>>();

// Track screenshots per step to display at end
const stepScreenshots = new Map<
  number,
  {
    name: string;
    preUrl?: string;
    postUrl?: string;
  }
>();

// Track downloaded files to display at end
const downloadedFiles: Array<{ type: string; path: string }> = [];

/**
 * Reset printed logs tracker (call on new test run)
 */
function resetPrintedLogs(): void {
  printedLogs.clear();
}

/**
 * Reset screenshot tracker (call on new test run)
 */
function resetScreenshots(): void {
  stepScreenshots.clear();
}

/**
 * Reset downloaded files tracker (call on new test run)
 */
function resetDownloadedFiles(): void {
  downloadedFiles.length = 0;
}

/**
 * Format success message
 */
export function success(message: string): string {
  return `${colors.green}✓${colors.reset} ${message}`;
}

/**
 * Format error message
 */
export function error(message: string): string {
  return `${colors.red}✗${colors.reset} ${message}`;
}

/**
 * Format warning message
 */
export function warning(message: string): string {
  return `${colors.yellow}⚠${colors.reset} ${message}`;
}

/**
 * Format info message
 */
export function info(message: string): string {
  return `${colors.blue}ℹ${colors.reset} ${message}`;
}

/**
 * Format step message
 */
export function step(index: number, total: number, message: string): string {
  return `${colors.gray}[${index}/${total}]${colors.reset} ${message}`;
}

/**
 * Format duration
 */
export function duration(seconds: number): string {
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(0)}ms`;
  }
  return `${seconds.toFixed(2)}s`;
}

/**
 * Progress bar for steps
 */
export function progressBar(completed: number, total: number, width: number = 30): string {
  const percentage = Math.floor((completed / total) * 100);
  const filled = Math.floor((completed / total) * width);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${colors.cyan}${bar}${colors.reset} ${percentage}%`;
}

/**
 * Format a single log line with appropriate icon based on prefix
 */
function formatLogLine(log: string): string {
  // Known prefixes and their icons/colors
  const prefixMap: Array<{ prefix: string; icon: string; color: string }> = [
    { prefix: '[Failed]', icon: '✗', color: colors.red },
    { prefix: '[Retry]', icon: '↻', color: colors.yellow },
    { prefix: '[Screenshot]', icon: '📷', color: colors.gray },
    { prefix: '[Info]', icon: 'ℹ', color: colors.blue },
    { prefix: '[Warning]', icon: '⚠', color: colors.yellow },
    { prefix: '[Error]', icon: '✗', color: colors.red },
  ];

  for (const { prefix, icon, color } of prefixMap) {
    if (log.startsWith(prefix)) {
      const message = log.slice(prefix.length).trim();
      return `  ${color}${icon}${colors.reset} ${colors.gray}${message}${colors.reset}`;
    }
  }

  // AI-based logs (don't have bracket prefix)
  if (log.startsWith('AI-based') || log.startsWith('Using AI')) {
    return `  ${colors.blue}🤖${colors.reset} ${colors.gray}${log}${colors.reset}`;
  }

  // Free-form logs without known prefix
  return `  ${colors.gray}· ${log}${colors.reset}`;
}

/**
 * Print a single log entry with multiline support
 */
function printLogEntry(log: string): void {
  // Handle multiline logs (e.g., [Failed] with stack traces)
  const lines = log.split('\n');
  console.log(formatLogLine(lines[0]));
  // Indent continuation lines
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      console.log(`    ${colors.gray}${lines[i]}${colors.reset}`);
    }
  }
}

/**
 * Print logs incrementally, avoiding duplicates for a given step
 * Logs are tracked per step_index to handle cumulative logs from backend
 */
function printLogsIncremental(stepIndex: number, logs: string[] | undefined): void {
  if (!logs?.length) return;

  let seen = printedLogs.get(stepIndex);
  if (!seen) {
    seen = new Set();
    printedLogs.set(stepIndex, seen);
  }

  for (const log of logs) {
    if (!seen.has(log)) {
      seen.add(log);
      printLogEntry(log);
    }
  }
}

/**
 * Print SSE event progress in real-time
 * @param event - SSE event to print
 * @param verbose - If true, also print raw event data
 * @param context - Optional context for features like --update-local
 */
export function printSSEProgress(
  event: SSEEvent,
  verbose: boolean = false,
  context?: SSEProgressContext
): void {
  // In verbose mode, print raw event data first
  if (verbose) {
    console.log(`${colors.gray}[${event.event}] ${JSON.stringify(event.data)}${colors.reset}`);
  }

  switch (event.event) {
    case 'start':
      resetPrintedLogs();
      resetScreenshots();
      resetDownloadedFiles();
      // Store runId in context for downloads
      if (context) {
        context.runId = event.data.run_id;
      }
      console.log(success(`Test started (run_id: ${event.data.run_id})`));
      console.log(`Total steps: ${event.data.total_steps}\n`);
      break;

    case 'step_start':
      console.log(`${colors.gray}[${event.data.step_index}]${colors.reset} ${event.data.name}...`);
      printLogsIncremental(event.data.step_index, event.data.logs);
      break;

    case 'step_retry': {
      const attempt = event.data.retry_attempt;
      const maxRetries = event.data.max_retries;
      const waitInfo = event.data.retry_wait_seconds
        ? ` (waited ${event.data.retry_wait_seconds}s)`
        : '';
      const phase = event.data.retry_phase;

      // Use different icons and colors based on retry phase
      // Only show tag for 'fixing' phase (AI self-healing)
      const isFixing = phase === 'fixing';
      const icon = isFixing
        ? `${colors.blue}🔧${colors.reset}`
        : `${colors.yellow}↻${colors.reset}`;
      const phaseTag = isFixing ? ` ${colors.blue}[fixing]${colors.reset}` : '';

      console.log(`  ${icon} Retry ${attempt}/${maxRetries}${waitInfo}${phaseTag}`);
      printLogsIncremental(event.data.step_index, event.data.logs);
      break;
    }

    case 'step_complete': {
      // Skip spurious 0ms step_complete events (backend sends these during retries)
      // But allow skipped steps through since they legitimately have 0 duration
      if (event.data.duration === 0 && event.data.status !== 'skipped') {
        break;
      }

      // Capture screenshot URLs if present (both pre and post)
      if (event.data.pre_screenshot_url || event.data.post_screenshot_url) {
        stepScreenshots.set(event.data.step_index, {
          name: event.data.name,
          preUrl: event.data.pre_screenshot_url,
          postUrl: event.data.post_screenshot_url,
        });

        // Download screenshots if download option is enabled
        if (context?.download && context?.runId) {
          const baseDir = context.downloadBaseDir || '/tmp/qa-use/downloads';
          const stepIndex = event.data.step_index;

          const stepName = event.data.name;

          // Download pre-screenshot
          if (event.data.pre_screenshot_url) {
            const ext = getExtensionFromUrl(event.data.pre_screenshot_url);
            const fileName = `step_${stepIndex}_pre${ext}`;
            const destPath = buildDownloadPath(
              baseDir,
              context.testId,
              context.runId,
              'screenshot',
              fileName,
              context.sourceFile
            );
            downloadFile(event.data.pre_screenshot_url, destPath)
              .then(() => {
                downloadedFiles.push({
                  type: `[${stepIndex}] ${stepName} (pre)`,
                  path: destPath,
                });
              })
              .catch((err) => {
                console.error(
                  `${colors.gray}Failed to download pre-screenshot: ${err.message}${colors.reset}`
                );
              });
          }

          // Download post-screenshot
          if (event.data.post_screenshot_url) {
            const ext = getExtensionFromUrl(event.data.post_screenshot_url);
            const fileName = `step_${stepIndex}_post${ext}`;
            const destPath = buildDownloadPath(
              baseDir,
              context.testId,
              context.runId,
              'screenshot',
              fileName,
              context.sourceFile
            );
            downloadFile(event.data.post_screenshot_url, destPath)
              .then(() => {
                downloadedFiles.push({
                  type: `[${stepIndex}] ${stepName} (post)`,
                  path: destPath,
                });
              })
              .catch((err) => {
                console.error(
                  `${colors.gray}Failed to download post-screenshot: ${err.message}${colors.reset}`
                );
              });
          }
        }
      }

      let status: string;
      let timeStr: string;
      if (event.data.status === 'passed') {
        status = `${colors.green}✓`;
        timeStr = ` ${colors.gray}${duration(event.data.duration)}${colors.reset}`;
      } else if (event.data.status === 'skipped') {
        status = `${colors.yellow}⊘`;
        // For skipped steps, print the step name since step_start wasn't shown
        console.log(
          `${colors.gray}[${event.data.step_index}]${colors.reset} ${event.data.name}...`
        );
        timeStr = ` ${colors.gray}skipped${colors.reset}`;
      } else {
        status = `${colors.red}✗`;
        timeStr = ` ${colors.gray}${duration(event.data.duration)}${colors.reset}`;
      }
      const hasScreenshots = event.data.pre_screenshot_url || event.data.post_screenshot_url;
      const screenshotIndicator = hasScreenshots ? ` ${colors.gray}📸${colors.reset}` : '';
      console.log(`${status}${colors.reset}${timeStr}${screenshotIndicator}`);
      // Print any remaining logs not yet printed
      printLogsIncremental(event.data.step_index, event.data.logs);
      break;
    }

    case 'complete':
      console.log('');
      if (event.data.status === 'passed') {
        console.log(success(`Test passed in ${duration(event.data.duration_seconds)}`));
      } else {
        console.log(error(`Test ${event.data.status} in ${duration(event.data.duration_seconds)}`));
      }
      break;

    case 'error':
      console.log('');
      console.log(error(`Test error: ${event.data.error}`));
      if (event.data.step_index !== undefined) {
        console.log(`At step ${event.data.step_index}`);
      }
      break;

    case 'persisted':
      console.log(success(`Test saved to cloud (ID: ${event.data.test_id})`));
      break;

    case 'test_fixed': {
      console.log('');
      console.log(`${colors.blue}🔧${colors.reset} Test auto-fixed: "${event.data.name}"`);

      if (context?.updateLocal && context?.sourceFile) {
        // event.data contains the fixed TestDefinition
        // Serialize based on source file extension
        const isYaml = context.sourceFile.match(/\.ya?ml$/i);
        const content = isYaml ? yaml.stringify(event.data) : JSON.stringify(event.data, null, 2);

        fs.writeFileSync(context.sourceFile, content);
        console.log(`${colors.green}✓${colors.reset} Updated ${context.sourceFile}`);
      } else {
        console.log(
          `${colors.gray}Use --update-local to save fixed version to local file.${colors.reset}`
        );
      }
      break;
    }

    case 'step_log':
      // Individual log line streamed from the backend
      printLogsIncremental(event.data.step_index, [event.data.log_line]);
      break;

    default:
      // Log unknown events in gray
      console.log(`${colors.gray}[${event.event}]${colors.reset}`);
  }
}

/**
 * Print test list table
 */
export function printTestList(
  tests: Array<{ name: string; steps?: number; deps?: string; tags?: string[] }>
): void {
  if (tests.length === 0) {
    console.log(warning('No tests found'));
    return;
  }

  console.log(`Found ${tests.length} test${tests.length === 1 ? '' : 's'}:\n`);

  for (const test of tests) {
    const stepCount = test.steps ? ` (${test.steps} steps)` : '';
    const deps = test.deps ? ` ${colors.gray}[depends: ${test.deps}]${colors.reset}` : '';
    const tags =
      test.tags && test.tags.length > 0
        ? ` ${colors.gray}[tags: ${test.tags.join(', ')}]${colors.reset}`
        : '';
    console.log(`  • ${test.name}${stepCount}${deps}${tags}`);
  }
}

/**
 * Print validation errors
 */
export function printValidationErrors(
  errors: Array<{ path: string; message: string; severity: string }>
): void {
  for (const err of errors) {
    const icon =
      err.severity === 'error'
        ? `${colors.red}✗`
        : err.severity === 'warning'
          ? `${colors.yellow}⚠`
          : `${colors.blue}ℹ`;
    console.log(`  ${icon}${colors.reset} ${err.path}: ${err.message}`);
  }
}

/**
 * Get screenshot URLs collected during execution
 */
export function getStepScreenshots(): Map<
  number,
  { name: string; preUrl?: string; postUrl?: string }
> {
  return new Map(stepScreenshots);
}

/**
 * Clear screenshot collection (for cleanup between test runs)
 */
export function clearStepScreenshots(): void {
  stepScreenshots.clear();
}

/**
 * Print screenshots summary table
 */
export function printScreenshotsSummary(): void {
  if (stepScreenshots.size === 0) {
    return;
  }

  console.log('\nScreenshots:');
  const sortedSteps = Array.from(stepScreenshots.entries()).sort((a, b) => a[0] - b[0]);
  for (const [stepIndex, { name, preUrl, postUrl }] of sortedSteps) {
    console.log(`  [${stepIndex + 1}] ${name}`);
    if (preUrl) {
      console.log(`      Pre:  ${preUrl}`);
    }
    if (postUrl) {
      console.log(`      Post: ${postUrl}`);
    }
  }
}

/**
 * Add downloaded file to tracking list
 */
export function addDownloadedFile(type: string, path: string): void {
  downloadedFiles.push({ type, path });
}

/**
 * Get list of downloaded files
 */
export function getDownloadedFiles(): Array<{ type: string; path: string }> {
  return [...downloadedFiles];
}

/**
 * Clear downloaded files list
 */
export function clearDownloadedFiles(): void {
  downloadedFiles.length = 0;
}

/**
 * Print downloaded files summary
 */
export function printDownloadedFilesSummary(): void {
  if (downloadedFiles.length === 0) {
    return;
  }

  console.log(
    `\nDownloaded ${downloadedFiles.length} file${downloadedFiles.length === 1 ? '' : 's'}:`
  );
  for (const { type, path } of downloadedFiles) {
    console.log(`  ${type}: ${path}`);
  }
}
