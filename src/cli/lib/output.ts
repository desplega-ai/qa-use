/**
 * Console output formatting utilities
 */

import type { SSEEvent } from '../../../lib/api/sse.js';

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
 * Print SSE event progress in real-time
 */
export function printSSEProgress(event: SSEEvent): void {
  switch (event.event) {
    case 'start':
      console.log(success(`Test started (run_id: ${event.data.run_id})`));
      console.log(`  Total steps: ${event.data.total_steps}\n`);
      break;

    case 'step_start':
      process.stdout.write(
        `  ${colors.gray}[${event.data.step_index + 1}]${colors.reset} ${event.data.name}...`
      );
      break;

    case 'step_complete': {
      const status = event.data.status === 'passed' ? colors.green + '✓' : colors.red + '✗';
      const time = duration(event.data.duration);
      console.log(` ${status}${colors.reset} ${colors.gray}${time}${colors.reset}`);
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
        console.log(`  At step ${event.data.step_index + 1}`);
      }
      break;

    case 'persisted':
      console.log(success(`Test saved to cloud (ID: ${event.data.test_id})`));
      break;

    default:
      // Log unknown events in gray
      console.log(`  ${colors.gray}[${event.event}]${colors.reset}`);
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
