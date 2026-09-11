/**
 * Reads a server-sent-event stream from a `fetch` response body.
 *
 * `EventSource` only does GET and can't send a JSON body, so the discovery
 * run — which is a POST — reads the stream itself. This handles the two
 * things a naive `TextDecoder` loop gets wrong: a chunk boundary landing in
 * the middle of an event, and a chunk carrying several events at once.
 *
 * Only the `data:` field is used; the pipeline doesn't name its events.
 */
export async function readEventStream<TEvent>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: TEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line. Anything after the last
      // separator is a partial event, so it stays in the buffer.
      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const rawEvent = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);

        const data = rawEvent
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");

        if (data) {
          try {
            onEvent(JSON.parse(data) as TEvent);
          } catch {
            // A malformed frame shouldn't kill the rest of the stream.
          }
        }
        separator = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
