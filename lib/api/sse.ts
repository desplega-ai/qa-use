/**
 * Server-Sent Events (SSE) parsing utilities
 *
 * Used for streaming test execution progress from /vibe-qa/cli/run endpoint
 */

export interface SSEEvent {
  event: string;
  data: any;
  id?: string;
}

/**
 * Find the boundary between SSE events
 * Handles both LF (\n\n) and CRLF (\r\n\r\n) line endings
 */
function findEventBoundary(buffer: string): { index: number; length: number } | -1 {
  // Check for CRLF first (more specific)
  const crlfPos = buffer.indexOf('\r\n\r\n');
  const lfPos = buffer.indexOf('\n\n');

  if (crlfPos === -1 && lfPos === -1) {
    return -1;
  }

  if (crlfPos !== -1 && (lfPos === -1 || crlfPos < lfPos)) {
    return { index: crlfPos, length: 4 };
  }

  return { index: lfPos, length: 2 };
}

/**
 * Parse SSE data from a chunk of text
 *
 * @param chunk - Raw SSE text chunk (may contain multiple events)
 * @returns Array of parsed SSE events
 */
export function parseSSE(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  // Split on \n and trim \r from each line to handle both LF and CRLF
  const lines = chunk.split('\n').map((line) => line.replace(/\r$/, ''));

  let currentEvent: Partial<SSEEvent> = {};

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent.event = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      const dataStr = line.slice(6);
      try {
        currentEvent.data = JSON.parse(dataStr);
      } catch {
        currentEvent.data = dataStr;
      }
    } else if (line.startsWith('id: ')) {
      currentEvent.id = line.slice(4).trim();
    } else if (line === '' || line === '\r') {
      // Empty line signals end of event
      if (currentEvent.event && currentEvent.data !== undefined) {
        events.push(currentEvent as SSEEvent);
      }
      currentEvent = {};
    }
    // Lines starting with ':' are comments (e.g., pings) - ignore them
  }

  // Push any pending event (in case chunk doesn't end with empty line)
  if (currentEvent.event && currentEvent.data !== undefined) {
    events.push(currentEvent as SSEEvent);
  }

  return events;
}

/**
 * Options for SSE consumption helpers
 */
export interface StreamSSEOptions {
  /**
   * Optional abort signal. When the signal is aborted, the read loop exits
   * cleanly (the generator returns without throwing) so callers using
   * `for await` can rely on graceful termination.
   */
  signal?: AbortSignal;
  /**
   * Optional callback invoked once per successful `reader.read()` chunk —
   * BEFORE parsing. This fires even for SSE comment pings (which produce
   * zero parsed events) so callers can use it as a heartbeat / idle-timeout
   * reset hook. Wired from `runCliTest` to reset the idle-timeout watchdog.
   */
  onChunk?: () => void;
}

/**
 * Stream SSE events from a Response object
 *
 * @param response - Fetch Response with SSE stream
 * @param options - Optional configuration (e.g. abort signal)
 * @yields SSE events as they arrive
 */
export async function* streamSSE(
  response: Response,
  options: StreamSSEOptions = {}
): AsyncGenerator<SSEEvent, void, unknown> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const { signal, onChunk } = options;

  // Fast-path: if the signal is already aborted, return immediately without
  // touching the response body.
  if (signal?.aborted) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Wire the signal to a Promise that resolves on abort so we can race it
  // against `reader.read()`. This is needed because a generic ReadableStream
  // (e.g. one not backed by `fetch`) won't surface the AbortSignal on its own
  // — the reader will simply keep awaiting. For `fetch`-backed streams, the
  // race is still safe: the read will reject with AbortError (caught below)
  // at roughly the same time as the abort fires.
  const ABORTED = Symbol('aborted');
  let abortListener: (() => void) | null = null;
  const abortPromise = signal
    ? new Promise<typeof ABORTED>((resolve) => {
        abortListener = () => resolve(ABORTED);
        signal.addEventListener('abort', abortListener, { once: true });
      })
    : null;

  try {
    while (true) {
      // Check for abort before each read so we exit promptly even if the
      // underlying socket hasn't surfaced the AbortError yet.
      if (signal?.aborted) {
        return;
      }

      let chunk: { done: boolean; value: Uint8Array | undefined };
      try {
        const readPromise = reader.read();
        const raceResult = abortPromise
          ? await Promise.race([readPromise, abortPromise])
          : await readPromise;

        if (raceResult === ABORTED) {
          // Cancel the underlying reader so it doesn't keep the stream alive.
          // `cancel()` may reject if already errored — swallow it.
          reader.cancel().catch(() => {});
          return;
        }

        chunk = raceResult as { done: boolean; value: Uint8Array | undefined };
      } catch (err) {
        // `fetch`'s reader rejects with an AbortError (DOMException) when the
        // associated signal is aborted. Swallow it and exit cleanly so callers
        // see the generator finish without an exception.
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        throw err;
      }

      const { done, value } = chunk;
      if (done) break;

      // Fire onChunk on every successful read — BEFORE parsing — so callers
      // can use it as an idle-timeout heartbeat. SSE comment pings produce
      // zero parsed events but DO arrive as byte chunks here, which is the
      // whole point: keep the watchdog alive even when only pings flow.
      if (onChunk) {
        try {
          onChunk();
        } catch {
          // Defensively swallow — a misbehaving onChunk must not break the
          // read loop. Hook is "best effort" by design.
        }
      }

      buffer += decoder.decode(value, { stream: true });

      // Find complete events (separated by double newlines)
      // Handle both LF (\n\n) and CRLF (\r\n\r\n) line endings
      let pos = findEventBoundary(buffer);
      while (pos !== -1) {
        const { index, length } = pos;
        const eventChunk = buffer.slice(0, index);
        buffer = buffer.slice(index + length);

        const events = parseSSE(eventChunk);
        for (const event of events) {
          yield event;
        }

        pos = findEventBoundary(buffer);
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const events = parseSSE(buffer);
      for (const event of events) {
        yield event;
      }
    }
  } finally {
    if (signal && abortListener) {
      signal.removeEventListener('abort', abortListener);
    }
    try {
      reader.releaseLock();
    } catch {
      // releaseLock can throw if the reader was already canceled by an abort;
      // safe to ignore — we're already on the cleanup path.
    }
  }
}

/**
 * Helper to consume an SSE stream and call a callback for each event
 *
 * @param response - Fetch Response with SSE stream
 * @param onEvent - Callback to handle each event
 * @param options - Optional configuration (e.g. abort signal); forwarded to streamSSE
 * @returns Promise that resolves when stream ends
 */
export async function consumeSSE(
  response: Response,
  onEvent: (event: SSEEvent) => void | Promise<void>,
  options: StreamSSEOptions = {}
): Promise<void> {
  for await (const event of streamSSE(response, options)) {
    await onEvent(event);
  }
}
