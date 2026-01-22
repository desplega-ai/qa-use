/**
 * Console output formatting utilities
 */

import * as fs from 'fs';
import * as yaml from 'yaml';
import type { SSEEvent } from '../../../lib/api/sse.js';

/**
 * Context for SSE progress output, used for features like --update-local
 */
export interface SSEProgressContext {
  /** Whether to update local file on test_fixed event */
  updateLocal?: boolean;
  /** Path to the source test definition file */
  sourceFile?: string;
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

/**
 * Reset printed logs tracker (call on new test run)
 */
function resetPrintedLogs(): void {
  printedLogs.clear();
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

      let status: string;
      let timeStr: string;
      if (event.data.status === 'passed') {
        status = colors.green + '✓';
        timeStr = ` ${colors.gray}${duration(event.data.duration)}${colors.reset}`;
      } else if (event.data.status === 'skipped') {
        status = colors.yellow + '⊘';
        // For skipped steps, print the step name since step_start wasn't shown
        console.log(
          `${colors.gray}[${event.data.step_index}]${colors.reset} ${event.data.name}...`
        );
        timeStr = ` ${colors.gray}skipped${colors.reset}`;
      } else {
        status = colors.red + '✗';
        timeStr = ` ${colors.gray}${duration(event.data.duration)}${colors.reset}`;
      }
      console.log(`${status}${colors.reset}${timeStr}`);
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
export function printTestList(tests: Array<{ name: string; steps?: number; deps?: string }>): void {
  if (tests.length === 0) {
    console.log(warning('No tests found'));
    return;
  }

  console.log(`Found ${tests.length} test${tests.length === 1 ? '' : 's'}:\n`);

  for (const test of tests) {
    const stepCount = test.steps ? ` (${test.steps} steps)` : '';
    const deps = test.deps ? ` ${colors.gray}[depends: ${test.deps}]${colors.reset}` : '';
    console.log(`  • ${test.name}${stepCount}${deps}`);
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
        ? colors.red + '✗'
        : err.severity === 'warning'
          ? colors.yellow + '⚠'
          : colors.blue + 'ℹ';
    console.log(`  ${icon}${colors.reset} ${err.path}: ${err.message}`);
  }
}
