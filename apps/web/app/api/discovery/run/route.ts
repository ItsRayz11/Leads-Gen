import { NextRequest, NextResponse } from "next/server";
import {
  runVertical1Hiring,
  runVertical2General,
  runVertical3CardAffiliate,
  runVertical4LiveSearch,
  type ProgressEvent,
} from "@leads/workers";
import { createClient } from "../../../../lib/supabase/server";

// Connectors make several sequential external HTTP calls; give this route
// room to run on platforms (e.g. Vercel Pro+) that honor maxDuration.
export const maxDuration = 300;
// Progress has to reach the browser while the run is still going, so this
// response must not be buffered or statically optimized.
export const dynamic = "force-dynamic";

const RUNNERS = {
  vertical1: runVertical1Hiring,
  vertical2: runVertical2General,
  vertical3: runVertical3CardAffiliate,
  vertical4: runVertical4LiveSearch,
} as const;

type Vertical = keyof typeof RUNNERS;

function isVertical(value: unknown): value is Vertical {
  return typeof value === "string" && value in RUNNERS;
}

/**
 * Streams a discovery run as server-sent events.
 *
 * A run makes many sequential external calls and can take minutes; the old
 * behaviour was a single blocking JSON response, so the page showed a
 * spinner and no way to tell a slow connector from a hung one. Each
 * `ProgressEvent` the pipeline emits is forwarded as it happens, and the
 * final `result` event carries exactly the same payload the JSON response
 * used to return.
 *
 * Events are queued rather than written directly: the pipeline reports
 * synchronously from inside its own loop, and `controller.enqueue` after the
 * stream closes throws.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const vertical = body?.vertical;
  if (!isVertical(vertical)) {
    return NextResponse.json(
      { error: `vertical must be one of ${Object.keys(RUNNERS).join(", ")}` },
      { status: 400 }
    );
  }

  const run = RUNNERS[vertical];
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ProgressEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // The client went away mid-run. Stop writing, but let the pipeline
          // finish — it is still writing real leads to the database.
          closed = true;
        }
      };

      try {
        const result = await run(send);
        send({ type: "result", result });
      } catch (err) {
        send({
          type: "error",
          error: err instanceof Error ? err.message : "Discovery run failed.",
        });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed by the client disconnecting */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tell any intermediary proxy (nginx in particular) not to buffer,
      // which would defeat the point of streaming.
      "X-Accel-Buffering": "no",
    },
  });
}
