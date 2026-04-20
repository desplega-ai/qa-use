import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { printTunnelReuseBanner, printTunnelStartBanner } from './tunnel-banner.js';

describe('printTunnelStartBanner', () => {
  let errSpy: ReturnType<typeof mock>;
  let originalError: typeof console.error;
  let originalIsTTY: unknown;
  let originalQuiet: string | undefined;

  beforeEach(() => {
    originalError = console.error;
    originalIsTTY = (process.stderr as { isTTY?: boolean }).isTTY;
    originalQuiet = process.env.QA_USE_QUIET;

    // Make the banner think it's on a TTY.
    Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
    delete process.env.QA_USE_QUIET;

    errSpy = mock(() => {});
    console.error = errSpy as unknown as typeof console.error;
  });

  afterEach(() => {
    console.error = originalError;
    Object.defineProperty(process.stderr, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    if (originalQuiet === undefined) {
      delete process.env.QA_USE_QUIET;
    } else {
      process.env.QA_USE_QUIET = originalQuiet;
    }
  });

  test('prints banner containing target, public URL, and opt-out text', () => {
    printTunnelStartBanner({
      target: 'http://localhost:3000',
      publicUrl: 'https://abc123.qa-use.dev',
    });

    const printed = errSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(printed).toContain('Auto-tunnel active');
    expect(printed).toContain('http://localhost:3000');
    expect(printed).toContain('https://abc123.qa-use.dev');
    expect(printed).toContain('--no-tunnel');
  });

  test('is suppressed when process.stderr.isTTY is false', () => {
    Object.defineProperty(process.stderr, 'isTTY', { value: false, configurable: true });

    printTunnelStartBanner({
      target: 'http://localhost:3000',
      publicUrl: 'https://abc123.qa-use.dev',
    });

    expect(errSpy).not.toHaveBeenCalled();
  });

  test('is suppressed when QA_USE_QUIET=1', () => {
    process.env.QA_USE_QUIET = '1';

    printTunnelStartBanner({
      target: 'http://localhost:3000',
      publicUrl: 'https://abc123.qa-use.dev',
    });

    expect(errSpy).not.toHaveBeenCalled();
  });

  test('is suppressed when quiet option is passed', () => {
    printTunnelStartBanner({
      target: 'http://localhost:3000',
      publicUrl: 'https://abc123.qa-use.dev',
      quiet: true,
    });

    expect(errSpy).not.toHaveBeenCalled();
  });
});

describe('printTunnelReuseBanner', () => {
  let errSpy: ReturnType<typeof mock>;
  let originalError: typeof console.error;
  let originalIsTTY: unknown;

  beforeEach(() => {
    originalError = console.error;
    originalIsTTY = (process.stderr as { isTTY?: boolean }).isTTY;
    Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
    delete process.env.QA_USE_QUIET;
    errSpy = mock(() => {});
    console.error = errSpy as unknown as typeof console.error;
  });

  afterEach(() => {
    console.error = originalError;
    Object.defineProperty(process.stderr, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
  });

  test('prints single-line reuse notice with target + public URL', () => {
    printTunnelReuseBanner({
      target: 'http://localhost:3000',
      publicUrl: 'https://abc123.qa-use.dev',
    });

    expect(errSpy).toHaveBeenCalledTimes(1);
    const line = errSpy.mock.calls[0][0] as string;
    expect(line).toContain('reuse');
    expect(line).toContain('http://localhost:3000');
    expect(line).toContain('https://abc123.qa-use.dev');
  });

  test('is suppressed when process.stderr.isTTY is false', () => {
    Object.defineProperty(process.stderr, 'isTTY', { value: false, configurable: true });
    printTunnelReuseBanner({
      target: 'http://localhost:3000',
      publicUrl: 'https://abc123.qa-use.dev',
    });
    expect(errSpy).not.toHaveBeenCalled();
  });
});
