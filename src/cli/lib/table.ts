/**
 * Reusable table formatter for CLI output.
 *
 * Supports column definitions, auto-width, JSON mode, empty state,
 * and pagination hints.
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------

export interface Column {
  /** Property key to extract from each row */
  key: string;
  /** Column header label */
  header: string;
  /** Fixed width; when omitted, auto-calculated from data */
  width?: number;
  /** Optional formatter for the cell value */
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

// ---------------------------------------------------------------------------
// printTable
// ---------------------------------------------------------------------------

export interface PrintTableOptions {
  /** When true, output raw JSON instead of a formatted table */
  json?: boolean;
  /** Title printed above the table */
  title?: string;
  /** Message shown when there are no rows */
  emptyMessage?: string;
  /** Page size — used to decide whether to show pagination hint */
  limit?: number;
  /** Current offset — used in pagination hint */
  offset?: number;
}

/**
 * Strip ANSI escape codes so we can measure visible width.
 */
function stripAnsi(str: string): number {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escapes
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

/**
 * Pad a string that may contain ANSI codes to a target *visible* width.
 */
function padCell(str: string, targetWidth: number): string {
  const visible = stripAnsi(str);
  const needed = targetWidth - visible;
  return needed > 0 ? str + ' '.repeat(needed) : str;
}

/**
 * Render a value as a string for table display.
 */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function printTable(
  columns: Column[],
  rows: Record<string, unknown>[],
  options: PrintTableOptions = {}
): void {
  // JSON mode — dump raw data and return
  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  // Empty state
  if (rows.length === 0) {
    console.log(options.emptyMessage ?? `${colors.yellow}⚠${colors.reset} No results found`);
    return;
  }

  // Title
  if (options.title) {
    console.log(`${options.title}\n`);
  }

  // Resolve column widths: use explicit width, or max of header + cell values
  const resolvedWidths: number[] = columns.map((col) => {
    if (col.width !== undefined) return col.width;
    let max = col.header.length;
    for (const row of rows) {
      const formatted = col.format ? col.format(row[col.key], row) : cellToString(row[col.key]);
      const len = stripAnsi(formatted);
      if (len > max) max = len;
    }
    return max;
  });

  // Header line
  const headerLine = columns.map((col, i) => padCell(col.header, resolvedWidths[i])).join('  ');
  console.log(headerLine);

  // Separator
  const totalWidth = resolvedWidths.reduce((s, w) => s + w, 0) + (columns.length - 1) * 2;
  console.log('─'.repeat(totalWidth));

  // Rows
  for (const row of rows) {
    const cells = columns.map((col, i) => {
      const formatted = col.format ? col.format(row[col.key], row) : cellToString(row[col.key]);
      return padCell(formatted, resolvedWidths[i]);
    });
    console.log(cells.join('  '));
  }

  // Pagination hint
  if (options.limit !== undefined && rows.length >= options.limit) {
    const nextOffset = (options.offset ?? 0) + options.limit;
    console.log(`\n${colors.gray}Use --offset ${nextOffset} to see more${colors.reset}`);
  }
}

// ---------------------------------------------------------------------------
// Shared formatters
// ---------------------------------------------------------------------------

/**
 * Color-coded status string (padded to 9 chars).
 */
export function formatStatus(status: string): string {
  const padded = status.padEnd(9);
  switch (status) {
    case 'passed':
    case 'active':
    case 'completed':
      return `${colors.green}${padded}${colors.reset}`;
    case 'failed':
    case 'error':
      return `${colors.red}${padded}${colors.reset}`;
    case 'running':
    case 'pending':
    case 'queued':
      return `${colors.yellow}${padded}${colors.reset}`;
    case 'cancelled':
    case 'timeout':
    case 'skipped':
    case 'inactive':
      return `${colors.gray}${padded}${colors.reset}`;
    default:
      return padded;
  }
}

/**
 * Human-readable timestamp from an ISO string.
 * Returns `YYYY-MM-DD HH:mm:ss` (19 chars).
 */
export function formatTimestamp(iso: string): string {
  if (!iso) return '-';
  try {
    const date = new Date(iso);
    return date.toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return iso;
  }
}

/**
 * Human-readable duration from seconds.
 */
export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || seconds === null) return '-';
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

/**
 * Truncate a string to `maxLen` characters, appending an ellipsis if needed.
 */
export function truncate(str: string, maxLen: number): string {
  if (maxLen < 1) return '';
  if (str.length <= maxLen) return str;
  if (maxLen <= 3) return str.slice(0, maxLen);
  return `${str.slice(0, maxLen - 1)}…`;
}
