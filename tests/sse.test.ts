import { describe, expect, it } from "vitest";
import { readEventStream } from "../apps/web/lib/sse";

const encoder = new TextEncoder();

/** A stream that hands out exactly the chunks given, in order. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(chunks: string[], signal?: AbortSignal): Promise<unknown[]> {
  const events: unknown[] = [];
  await readEventStream(streamOf(chunks), (e) => events.push(e), signal);
  return events;
}

describe("readEventStream", () => {
  it("reads a single event", async () => {
    expect(await collect(['data: {"type":"stage"}\n\n'])).toEqual([{ type: "stage" }]);
  });

  it("reads several events delivered in one chunk", async () => {
    const events = await collect(['data: {"n":1}\n\ndata: {"n":2}\n\ndata: {"n":3}\n\n']);
    expect(events).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it("reassembles an event split across chunk boundaries", async () => {
    const events = await collect(['data: {"type":"conn', 'ector:done","signalsFound":4}', "\n\n"]);
    expect(events).toEqual([{ type: "connector:done", signalsFound: 4 }]);
  });

  it("reassembles when the boundary splits the blank-line separator itself", async () => {
    const events = await collect(['data: {"a":1}\n', '\ndata: {"a":2}\n\n']);
    expect(events).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("handles a multi-byte character split across chunks", async () => {
    // "…" is three UTF-8 bytes; cut it in half to prove the decoder streams.
    const bytes = encoder.encode('data: {"m":"a…b"}\n\n');
    const cut = 14; // lands inside the ellipsis
    const events: unknown[] = [];
    await readEventStream(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, cut));
          controller.enqueue(bytes.slice(cut));
          controller.close();
        },
      }),
      (e) => events.push(e)
    );
    expect(events).toEqual([{ m: "a…b" }]);
  });

  it("ignores a malformed frame but keeps reading the rest", async () => {
    const events = await collect(["data: not-json\n\n", 'data: {"ok":true}\n\n']);
    expect(events).toEqual([{ ok: true }]);
  });

  it("ignores non-data lines such as comments and event names", async () => {
    const events = await collect([': keep-alive\n\nevent: ping\ndata: {"ok":1}\n\n']);
    expect(events).toEqual([{ ok: 1 }]);
  });

  it("drops a trailing partial event rather than emitting half of it", async () => {
    expect(await collect(['data: {"done":1}\n\ndata: {"part'])).toEqual([{ done: 1 }]);
  });

  it("tolerates a data line with no space after the colon", async () => {
    expect(await collect(['data:{"tight":true}\n\n'])).toEqual([{ tight: true }]);
  });

  it("stops early when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await collect(['data: {"n":1}\n\n'], controller.signal)).toEqual([]);
  });
});
