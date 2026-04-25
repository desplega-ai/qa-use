/**
 * Unit tests for SSE parsing and streaming utilities.
 *
 * Covers:
 *  - parseSSE round-trip (LF + CRLF) — pins existing parsing behavior.
 *  - streamSSE returns cleanly when the AbortSignal is aborted mid-stream
 *    (no thrown error), within a tight time budget.
 *  - runCliTest exits within ~200ms of receiving a terminal `complete` /
 *    `error` SSE event even when the underlying stream stays open (Phase 2
 *    regression: the cope-api hang where the SSE socket stays alive ~80s
 *    after the test finishes).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ApiClient } from './index.js';
import { parseSSE, streamSSE } from './sse.js';

describe('parseSSE', () => {
  it('parses a single event with LF line endings', () => {
    const chunk = 'event: complete\ndata: {"status":"passed"}\n\n';
    const events = parseSSE(chunk);

    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe('complete');
    expect(events[0]?.data).toEqual({ status: 'passed' });
  });

  it('parses a single event with CRLF line endings', () => {
    const chunk = 'event: complete\r\ndata: {"status":"passed"}\r\n\r\n';
    const events = parseSSE(chunk);

    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe('complete');
    expect(events[0]?.data).toEqual({ status: 'passed' });
  });

  it('parses multiple events in a single chunk (LF)', () => {
    const chunk =
      'event: start\ndata: {"run_id":"abc"}\n\n' +
      'event: step_complete\ndata: {"step_index":0}\n\n' +
      'event: complete\ndata: {"status":"passed"}\n\n';
    const events = parseSSE(chunk);

    expect(events).toHaveLength(3);
    expect(events.map((e) => e.event)).toEqual(['start', 'step_complete', 'complete']);
  });

  it('parses multiple events in a single chunk (CRLF)', () => {
    const chunk =
      'event: start\r\ndata: {"run_id":"abc"}\r\n\r\n' +
      'event: step_complete\r\ndata: {"step_index":0}\r\n\r\n' +
      'event: complete\r\ndata: {"status":"passed"}\r\n\r\n';
    const events = parseSSE(chunk);

    expect(events).toHaveLength(3);
    expect(events.map((e) => e.event)).toEqual(['start', 'step_complete', 'complete']);
  });

  it('parses id field when present', () => {
    const chunk = 'id: 42\nevent: ping\ndata: "hi"\n\n';
    const events = parseSSE(chunk);

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe('42');
  });

  it('falls back to raw string when data is not JSON', () => {
    const chunk = 'event: log\ndata: not-json-payload\n\n';
    const events = parseSSE(chunk);

    expect(events).toHaveLength(1);
    expect(events[0]?.data).toBe('not-json-payload');
  });

  it('ignores comment lines (pings)', () => {
    const chunk = ': keep-alive\n\nevent: complete\ndata: {"ok":true}\n\n';
    const events = parseSSE(chunk);

    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe('complete');
  });
});

describe('streamSSE abort behavior', () => {
  /**
   * Build a Response whose body is a ReadableStream that emits one initial
   * event, then never closes. Lets us simulate the cope-api hang where the
   * server keeps the SSE stream open after `complete`.
   */
  function makeHangingResponse(initialChunk: string): {
    response: Response;
    cancel: () => void;
  } {
    let cancelled = false;
    let cancelHandle: (() => void) | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(initialChunk));
        // Intentionally never call controller.close() — mimic an open SSE
        // stream that the backend isn't terminating.
        cancelHandle = () => {
          if (cancelled) return;
          cancelled = true;
          try {
            controller.close();
          } catch {
            // Already closed/errored — ignore.
          }
        };
      },
      cancel() {
        cancelled = true;
      },
    });

    const response = new Response(stream, {
      headers: { 'content-type': 'text/event-stream' },
    });

    return {
      response,
      cancel: () => cancelHandle?.(),
    };
  }

  it('returns cleanly within 50ms when the signal aborts mid-stream', async () => {
    const { response, cancel } = makeHangingResponse('event: start\ndata: {"run_id":"abc"}\n\n');

    const controller = new AbortController();

    // Schedule abort shortly after iteration begins.
    setTimeout(() => controller.abort(), 5);

    const start = performance.now();
    const events: string[] = [];

    try {
      for await (const event of streamSSE(response, { signal: controller.signal })) {
        events.push(event.event);
      }
    } finally {
      cancel();
    }

    const elapsed = performance.now() - start;

    // We received the initial event before the abort fired.
    expect(events).toContain('start');
    // The for-await loop terminated cleanly (no throw) and quickly.
    expect(elapsed).toBeLessThan(50);
  });

  it('returns immediately if the signal is already aborted', async () => {
    const { response, cancel } = makeHangingResponse('event: start\ndata: {}\n\n');

    const controller = new AbortController();
    controller.abort();

    const start = performance.now();
    const events: string[] = [];

    try {
      for await (const event of streamSSE(response, { signal: controller.signal })) {
        events.push(event.event);
      }
    } finally {
      cancel();
    }

    const elapsed = performance.now() - start;

    expect(events).toEqual([]);
    expect(elapsed).toBeLessThan(50);
  });
});

describe('runCliTest terminal-event close', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    // No-op; per-test installs its own mock.
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /**
   * Build a Response whose body emits the supplied chunks (one per microtask
   * tick) and then **never closes**. Reproduces the cope-api SSE hang the
   * fix is targeting. Returns a `forceClose` to defensively shut the
   * controller after each test so a leaked stream can't keep the bun
   * process alive.
   */
  function makeStreamingResponse(chunks: string[]): {
    response: Response;
    forceClose: () => void;
  } {
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let closed = false;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        const encoder = new TextEncoder();
        // Enqueue each chunk on its own microtask so the for-await loop sees
        // them as separate reads. Order is preserved because each Promise
        // resolves before the next is scheduled.
        (async () => {
          for (const chunk of chunks) {
            await Promise.resolve();
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              return;
            }
          }
          // Intentionally do not call controller.close() — mimic the backend
          // keeping the SSE stream open after `complete`.
        })();
      },
      cancel() {
        closed = true;
      },
    });

    const response = new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });

    return {
      response,
      forceClose: () => {
        if (closed) return;
        closed = true;
        try {
          streamController?.close();
        } catch {
          // Already closed/errored — ignore.
        }
      },
    };
  }

  it('resolves within 200ms after receiving a `complete` chunk on a never-closing stream', async () => {
    const chunks = [
      'event: start\ndata: {"run_id":"abc"}\n\n',
      'event: step_complete\ndata: {"step_index":0}\n\n',
      'event: complete\ndata: {"run_id":"abc","status":"passed","duration_seconds":1.2,"steps":[]}\n\n',
    ];

    const { response, forceClose } = makeStreamingResponse(chunks);

    globalThis.fetch = (async () => response) as unknown as typeof fetch;

    const client = new ApiClient('http://localhost:0');

    const start = performance.now();
    try {
      const result = await client.runCliTest({ test_id: 'abc' });
      const elapsed = performance.now() - start;

      expect(result.run_id).toBe('abc');
      expect(result.status).toBe('passed');
      // The whole flow (fetch + 3 chunked reads + abort + return) should be
      // well under 200ms — the stream itself never closes, so anything close
      // to the server-side hang would blow this budget.
      expect(elapsed).toBeLessThan(200);
    } finally {
      forceClose();
    }
  });

  it('resolves with status=error within 200ms after an `error` event on a never-closing stream', async () => {
    const chunks = [
      'event: start\ndata: {"run_id":"def"}\n\n',
      'event: error\ndata: {"run_id":"def","status":"error","duration_seconds":0.5,"steps":[],"error":"boom"}\n\n',
    ];

    const { response, forceClose } = makeStreamingResponse(chunks);

    globalThis.fetch = (async () => response) as unknown as typeof fetch;

    const client = new ApiClient('http://localhost:0');

    const start = performance.now();
    try {
      const result = await client.runCliTest({ test_id: 'def' });
      const elapsed = performance.now() - start;

      expect(result.status).toBe('error');
      expect(result.run_id).toBe('def');
      expect(elapsed).toBeLessThan(200);
    } finally {
      forceClose();
    }
  });
});

describe('runCliTest idle-timeout watchdog', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /**
   * Build a Response whose body emits chunks at fixed intervals, then never
   * closes. Used to simulate "events keep arriving" vs "stream went silent"
   * scenarios for the idle-timeout watchdog.
   *
   * @param schedule - Array of `{ delayMs, chunk }`. Each chunk is enqueued
   *   `delayMs` after the PREVIOUS chunk (cumulative scheduling).
   */
  function makeScheduledResponse(schedule: { delayMs: number; chunk: string }[]): {
    response: Response;
    forceClose: () => void;
  } {
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let closed = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        const encoder = new TextEncoder();
        let cumulativeDelay = 0;
        for (const { delayMs, chunk } of schedule) {
          cumulativeDelay += delayMs;
          const t = setTimeout(() => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              // Already closed/errored — ignore.
            }
          }, cumulativeDelay);
          timers.push(t);
        }
        // Intentionally never call controller.close().
      },
      cancel() {
        closed = true;
        for (const t of timers) clearTimeout(t);
      },
    });

    const response = new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });

    return {
      response,
      forceClose: () => {
        if (closed) return;
        closed = true;
        for (const t of timers) clearTimeout(t);
        try {
          streamController?.close();
        } catch {
          // Already closed/errored — ignore.
        }
      },
    };
  }

  it('rejects with /timed out/ when the stream goes silent past idleTimeoutSec', async () => {
    // Emit `start` immediately, then nothing for 1s. With idleTimeoutSec=0.5,
    // the watchdog must fire ~500ms after the `start` chunk arrives.
    const { response, forceClose } = makeScheduledResponse([
      { delayMs: 0, chunk: 'event: start\ndata: {"run_id":"abc"}\n\n' },
    ]);

    globalThis.fetch = (async () => response) as unknown as typeof fetch;

    const client = new ApiClient('http://localhost:0');

    const start = performance.now();
    try {
      await expect(
        client.runCliTest({ test_id: 'abc' }, undefined, { idleTimeoutSec: 0.5 })
      ).rejects.toThrow(/timed out/);
    } finally {
      forceClose();
    }
    const elapsed = performance.now() - start;

    // Should fire within ~500ms; allow generous headroom for CI flake.
    expect(elapsed).toBeLessThan(1500);
    // And it should have actually waited at least the idle window. Allow
    // a little slack on timer scheduling (>= 400ms is a safe lower bound
    // for a 500ms watchdog under load).
    expect(elapsed).toBeGreaterThanOrEqual(400);
  });

  it('does NOT time out when events arrive faster than idleTimeoutSec', async () => {
    // Emit a chunk every 100ms for ~1s, then a `complete`. With
    // idleTimeoutSec=1 the watchdog should keep getting reset and never fire.
    const schedule: { delayMs: number; chunk: string }[] = [
      { delayMs: 0, chunk: 'event: start\ndata: {"run_id":"abc"}\n\n' },
    ];
    for (let i = 0; i < 8; i++) {
      schedule.push({
        delayMs: 100,
        chunk: `event: step_log\ndata: {"step_index":${i}}\n\n`,
      });
    }
    schedule.push({
      delayMs: 100,
      chunk:
        'event: complete\ndata: {"run_id":"abc","status":"passed","duration_seconds":1,"steps":[]}\n\n',
    });

    const { response, forceClose } = makeScheduledResponse(schedule);

    globalThis.fetch = (async () => response) as unknown as typeof fetch;

    const client = new ApiClient('http://localhost:0');

    try {
      const result = await client.runCliTest({ test_id: 'abc' }, undefined, {
        idleTimeoutSec: 1,
      });
      expect(result.status).toBe('passed');
      expect(result.run_id).toBe('abc');
    } finally {
      forceClose();
    }
  });

  it('SSE comment pings (no parsed events) reset the watchdog via onChunk', async () => {
    // Emit `start`, then `: ping\n\n` comment lines every 200ms. These produce
    // ZERO parsed events but DO arrive as byte chunks — so onChunk should
    // reset the watchdog. With idleTimeoutSec=0.5 this would otherwise fire
    // at 500ms; we'll forcibly close after ~1.2s and assert no timeout error.
    const schedule: { delayMs: number; chunk: string }[] = [
      { delayMs: 0, chunk: 'event: start\ndata: {"run_id":"abc"}\n\n' },
    ];
    for (let i = 0; i < 5; i++) {
      schedule.push({ delayMs: 200, chunk: `: ping ${i}\n\n` });
    }
    // After ~1s of pings, send `complete` to terminate cleanly.
    schedule.push({
      delayMs: 100,
      chunk:
        'event: complete\ndata: {"run_id":"abc","status":"passed","duration_seconds":1,"steps":[]}\n\n',
    });

    const { response, forceClose } = makeScheduledResponse(schedule);

    globalThis.fetch = (async () => response) as unknown as typeof fetch;

    const client = new ApiClient('http://localhost:0');

    try {
      const result = await client.runCliTest({ test_id: 'abc' }, undefined, {
        idleTimeoutSec: 0.5,
      });
      // We made it to `complete` without the watchdog firing — pings reset it.
      expect(result.status).toBe('passed');
    } finally {
      forceClose();
    }
  });

  it('propagates external abort via the caller-supplied signal', async () => {
    // Emit `start`, then nothing — we'll abort the caller signal mid-stream
    // and assert runCliTest rejects (re-throws AbortError) rather than
    // swallowing or stalling. Pins Phase 3's "external" terminationReason
    // distinction vs "complete" / "idle-timeout".
    const { response, forceClose } = makeScheduledResponse([
      { delayMs: 0, chunk: 'event: start\ndata: {"run_id":"abc"}\n\n' },
    ]);

    globalThis.fetch = (async () => response) as unknown as typeof fetch;

    const client = new ApiClient('http://localhost:0');

    const callerController = new AbortController();
    // Schedule the external abort just after the stream starts.
    setTimeout(() => callerController.abort(), 20);

    const start = performance.now();
    try {
      // The promise must reject — NOT swallow the abort and NOT stall.
      await expect(
        client.runCliTest({ test_id: 'abc' }, undefined, {
          signal: callerController.signal,
        })
      ).rejects.toThrow();
    } finally {
      forceClose();
    }
    const elapsed = performance.now() - start;

    // Should reject within ~200ms of the external abort firing.
    expect(elapsed).toBeLessThan(500);
  });

  it('idleTimeoutSec=0 disables the watchdog entirely', async () => {
    // Emit `start`, wait 600ms (longer than any reasonable timeout), then
    // `complete`. With idleTimeoutSec=0 nothing should fire.
    const { response, forceClose } = makeScheduledResponse([
      { delayMs: 0, chunk: 'event: start\ndata: {"run_id":"abc"}\n\n' },
      {
        delayMs: 600,
        chunk:
          'event: complete\ndata: {"run_id":"abc","status":"passed","duration_seconds":0.6,"steps":[]}\n\n',
      },
    ]);

    globalThis.fetch = (async () => response) as unknown as typeof fetch;

    const client = new ApiClient('http://localhost:0');

    try {
      const result = await client.runCliTest({ test_id: 'abc' }, undefined, {
        idleTimeoutSec: 0,
      });
      expect(result.status).toBe('passed');
    } finally {
      forceClose();
    }
  });
});
