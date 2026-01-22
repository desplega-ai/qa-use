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
 * Stream SSE events from a Response object
 *
 * @param response - Fetch Response with SSE stream
 * @yields SSE events as they arrive
 */
export async function* streamSSE(response: Response): AsyncGenerator<SSEEvent, void, unknown> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

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
    reader.releaseLock();
  }
}

/**
 * Helper to consume an SSE stream and call a callback for each event
 *
 * @param response - Fetch Response with SSE stream
 * @param onEvent - Callback to handle each event
 * @returns Promise that resolves when stream ends
 */
export async function consumeSSE(
  response: Response,
  onEvent: (event: SSEEvent) => void | Promise<void>
): Promise<void> {
  for await (const event of streamSSE(response)) {
    await onEvent(event);
  }
}
