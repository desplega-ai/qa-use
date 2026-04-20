import { describe, expect, test } from 'bun:test';
import { Command } from 'commander';
import { addTunnelOption, type TunnelMode } from './tunnel-option.js';

function makeCmd() {
  let captured: { tunnel?: TunnelMode | boolean } = {};
  const cmd = new Command('test')
    .exitOverride() // throw instead of process.exit on errors
    .configureOutput({
      // Silence output during tests
      writeOut: () => {},
      writeErr: () => {},
    });
  addTunnelOption(cmd);
  cmd.action((opts) => {
    captured = opts;
  });
  return {
    parse: (args: string[]) => {
      cmd.parse(['node', 'test', ...args], { from: 'node' });
      return captured;
    },
    cmd,
  };
}

describe('addTunnelOption', () => {
  test('parses --tunnel auto', () => {
    const { parse } = makeCmd();
    const opts = parse(['--tunnel', 'auto']);
    expect(opts.tunnel).toBe('auto');
  });

  test('parses --tunnel on', () => {
    const { parse } = makeCmd();
    const opts = parse(['--tunnel', 'on']);
    expect(opts.tunnel).toBe('on');
  });

  test('parses --tunnel off', () => {
    const { parse } = makeCmd();
    const opts = parse(['--tunnel', 'off']);
    expect(opts.tunnel).toBe('off');
  });

  test('defaults to auto when no flag passed', () => {
    const { parse } = makeCmd();
    const opts = parse([]);
    expect(opts.tunnel).toBe('auto');
  });

  test('--no-tunnel resolves to off', () => {
    const { parse } = makeCmd();
    const opts = parse(['--no-tunnel']);
    expect(opts.tunnel).toBe('off');
  });

  test('rejects invalid value', () => {
    const { parse } = makeCmd();
    expect(() => parse(['--tunnel', 'bogus'])).toThrow();
  });

  test('rejects empty string', () => {
    const { parse } = makeCmd();
    expect(() => parse(['--tunnel', ''])).toThrow();
  });

  test('accepts uppercase value (case-insensitive)', () => {
    const { parse } = makeCmd();
    const opts = parse(['--tunnel', 'ON']);
    expect(opts.tunnel).toBe('on');
  });
});
