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
 * Parse SSE data from a chunk of text
 *
 * @param chunk - Raw SSE text chunk (may contain multiple events)
 * @returns Array of parsed SSE events
 */
export function parseSSE(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = chunk.split('\n');

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
    } else if (line === '') {
      // Empty line signals end of event
      if (currentEvent.event && currentEvent.data !== undefined) {
        events.push(currentEvent as SSEEvent);
      }
      currentEvent = {};
    }
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
      let pos = buffer.indexOf('\n\n');
      while (pos !== -1) {
        const chunk = buffer.slice(0, pos + 2);
        buffer = buffer.slice(pos + 2);

        const events = parseSSE(chunk);
        for (const event of events) {
          yield event;
        }

        pos = buffer.indexOf('\n\n');
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
