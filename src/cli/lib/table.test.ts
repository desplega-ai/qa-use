import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { formatDuration, formatStatus, formatTimestamp, printTable, truncate } from './table.js';

// ---------------------------------------------------------------------------
// printTable
// ---------------------------------------------------------------------------

describe('printTable', () => {
  let logSpy: ReturnType<typeof spyOn>;
  let output: string[];

  beforeEach(() => {
    output = [];
    logSpy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  const columns = [
    { key: 'id', header: 'ID', width: 6 },
    { key: 'name', header: 'NAME', width: 10 },
  ];

  it('should render header and rows', () => {
    printTable(columns, [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ]);

    expect(output[0]).toContain('ID');
    expect(output[0]).toContain('NAME');
    // Separator
    expect(output[1]).toContain('─');
    // Data rows
    expect(output[2]).toContain('1');
    expect(output[2]).toContain('Alpha');
    expect(output[3]).toContain('2');
    expect(output[3]).toContain('Beta');
  });

  it('should output JSON in json mode', () => {
    const rows = [{ id: '1', name: 'Test' }];
    printTable(columns, rows, { json: true });

    const parsed = JSON.parse(output.join('\n'));
    expect(parsed).toEqual(rows);
  });

  it('should show empty message when no rows', () => {
    printTable(columns, [], { emptyMessage: 'Nothing here' });
    expect(output[0]).toContain('Nothing here');
  });

  it('should show default empty message', () => {
    printTable(columns, []);
    expect(output[0]).toContain('No results found');
  });

  it('should print title when provided', () => {
    printTable(columns, [{ id: '1', name: 'X' }], { title: 'My Title' });
    expect(output[0]).toContain('My Title');
  });

  it('should show pagination hint when rows hit limit', () => {
    const rows = [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ];
    printTable(columns, rows, { limit: 2, offset: 0 });
    const last = output[output.length - 1];
    expect(last).toContain('--offset 2');
  });

  it('should not show pagination hint when rows below limit', () => {
    printTable(columns, [{ id: '1', name: 'A' }], { limit: 5 });
    const joined = output.join('\n');
    expect(joined).not.toContain('--offset');
  });

  it('should use custom format function', () => {
    const cols = [
      {
        key: 'val',
        header: 'VALUE',
        format: (v: unknown) => `[${v}]`,
      },
    ];
    printTable(cols, [{ val: 'hi' }]);
    expect(output[2]).toContain('[hi]');
  });

  it('should auto-calculate column widths from data', () => {
    const cols = [{ key: 'name', header: 'N' }];
    printTable(cols, [{ name: 'LongName' }]);
    // Header should be padded to at least the data width
    // "LongName" is 8 chars, header "N" is 1 char, so width should be 8
    // Both header and data lines should contain the content
    expect(output[2]).toContain('LongName');
  });

  it('should handle null and undefined values', () => {
    printTable(columns, [{ id: null, name: undefined }]);
    // null/undefined render as "-"
    expect(output[2]).toContain('-');
  });
});

// ---------------------------------------------------------------------------
// formatStatus
// ---------------------------------------------------------------------------

describe('formatStatus', () => {
  it('should color passed/active/completed green', () => {
    for (const status of ['passed', 'active', 'completed']) {
      const result = formatStatus(status);
      expect(result).toContain('\x1b[32m'); // green
      expect(result).toContain(status);
    }
  });

  it('should color failed/error red', () => {
    for (const status of ['failed', 'error']) {
      const result = formatStatus(status);
      expect(result).toContain('\x1b[31m'); // red
      expect(result).toContain(status);
    }
  });

  it('should color running/pending/queued yellow', () => {
    for (const status of ['running', 'pending', 'queued']) {
      const result = formatStatus(status);
      expect(result).toContain('\x1b[33m'); // yellow
      expect(result).toContain(status);
    }
  });

  it('should color cancelled/timeout/skipped/inactive gray', () => {
    for (const status of ['cancelled', 'timeout', 'skipped', 'inactive']) {
      const result = formatStatus(status);
      expect(result).toContain('\x1b[90m'); // gray
      expect(result).toContain(status);
    }
  });

  it('should return uncolored string for unknown status', () => {
    const result = formatStatus('unknown');
    expect(result).not.toContain('\x1b[');
    expect(result).toContain('unknown');
  });

  it('should pad status to 9 characters', () => {
    // "passed" is 6 chars, padded to 9
    const result = formatStatus('passed');
    // Strip ANSI to check padding
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escapes
    const stripped = result.replace(/\x1b\[[0-9;]*m/g, '');
    expect(stripped.length).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// formatTimestamp
// ---------------------------------------------------------------------------

describe('formatTimestamp', () => {
  it('should format ISO string to YYYY-MM-DD HH:mm:ss', () => {
    const result = formatTimestamp('2024-01-15T10:30:45.000Z');
    expect(result).toBe('2024-01-15 10:30:45');
  });

  it('should return dash for empty string', () => {
    expect(formatTimestamp('')).toBe('-');
  });

  it('should return original string for invalid date', () => {
    // new Date('not-a-date') => Invalid Date => toISOString() throws
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('should format seconds under 60', () => {
    expect(formatDuration(5.3)).toBe('5.3s');
    expect(formatDuration(0.1)).toBe('0.1s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(60)).toBe('1m 0s');
  });

  it('should return dash for undefined', () => {
    expect(formatDuration(undefined)).toBe('-');
  });

  it('should return dash for null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(formatDuration(null as any)).toBe('-');
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate long strings with ellipsis', () => {
    const result = truncate('hello world', 6);
    expect(result).toBe('hello…');
    expect(result.length).toBe(6);
  });

  it('should handle maxLen equal to string length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('should handle maxLen of 1', () => {
    expect(truncate('hello', 1)).toBe('h');
  });

  it('should handle maxLen of 3 or less without ellipsis', () => {
    expect(truncate('hello', 3)).toBe('hel');
  });

  it('should return empty string for maxLen 0', () => {
    expect(truncate('hello', 0)).toBe('');
  });

  it('should handle empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});
