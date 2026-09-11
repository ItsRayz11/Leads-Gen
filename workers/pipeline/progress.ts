/**
 * The event stream a discovery run emits while it works.
 *
 * A vertical run makes a long series of external HTTP calls (one per job
 * board, per agency website, per Twitter search) and then a second series of
 * database round-trips per company. Blocking until all of that finishes and
 * only then returning a total is what made the Discovery page feel like it
 * might be doing nothing at all. Runners take an optional `onProgress` and
 * report each step as it happens; the API route forwards these to the browser
 * as server-sent events.
 *
 * Emitting is strictly optional — every runner still returns the same
 * `RunResult` when called with no callback, which is how the CLI scripts and
 * the GitHub Action use them.
 */

import type { ConnectorCount, RunResult } from "./shared.js";

/** Coarse phases of a run, in the order they occur. */
export type RunStage = "starting" | "connectors" | "dedupe" | "scoring" | "done";

export type ProgressEvent =
  /** A phase began. `message` is user-facing. */
  | { type: "stage"; stage: RunStage; message: string }
  /** A connector's fetch started — shown as in-flight until its matching done/error. */
  | { type: "connector:start"; connector: string }
  /** A connector finished. `note` explains a zero that isn't simply "no matches". */
  | { type: "connector:done"; connector: string; signalsFound: number; note?: string }
  /** A connector threw. The run continues with the others; this is reported, never swallowed. */
  | { type: "connector:error"; connector: string; error: string }
  /** A connector was skipped before it ran (disabled in code, or gated off). */
  | { type: "connector:skipped"; connector: string; reason: string }
  /** One lead finished upserting + scoring. `index`/`total` drive a determinate progress bar. */
  | { type: "lead"; companyName: string; score: number; index: number; total: number }
  /** The run finished. Always the last event on a successful stream. */
  | { type: "result"; result: RunResult }
  /** The run itself failed (not just one connector). Always the last event when present. */
  | { type: "error"; error: string };

export type ProgressReporter = (event: ProgressEvent) => void;

/**
 * Wraps a reporter so a throwing/closed sink (a browser that navigated away
 * mid-run) can never abort the pipeline. Discovery writes real rows to the
 * database; losing the progress channel must not lose that work.
 */
export function safeReporter(onProgress?: ProgressReporter): ProgressReporter {
  if (!onProgress) return () => {};
  return (event) => {
    try {
      onProgress(event);
    } catch {
      /* the run matters more than the commentary about it */
    }
  };
}

/** Turns a caught unknown into the message a user should see. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

/**
 * Shared connector loop used by every vertical: runs each enabled connector,
 * reports start/done/error/skipped, and records a `ConnectorCount` for all of
 * them — including the ones that threw, which used to be logged to stderr and
 * then vanish from the run summary entirely.
 */
export async function runConnectors<TConnector extends { name: string; enabled: boolean }, TSignal>(
  connectors: TConnector[],
  fetchOne: (connector: TConnector) => Promise<TSignal[]>,
  report: ProgressReporter,
  zeroResultNote?: (connectorName: string) => Promise<string | undefined>
): Promise<{ signals: TSignal[]; connectorCounts: ConnectorCount[] }> {
  const signals: TSignal[] = [];
  const connectorCounts: ConnectorCount[] = [];

  for (const connector of connectors) {
    if (!connector.enabled) {
      report({ type: "connector:skipped", connector: connector.name, reason: "disabled" });
      continue;
    }
    report({ type: "connector:start", connector: connector.name });
    try {
      const found = await fetchOne(connector);
      const note = found.length === 0 ? await zeroResultNote?.(connector.name) : undefined;
      connectorCounts.push({ connector: connector.name, signalsFound: found.length, note });
      report({ type: "connector:done", connector: connector.name, signalsFound: found.length, note });
      signals.push(...found);
    } catch (err) {
      const error = errorMessage(err);
      console.error(`[${connector.name}] failed:`, err);
      connectorCounts.push({ connector: connector.name, signalsFound: 0, error });
      report({ type: "connector:error", connector: connector.name, error });
    }
  }

  return { signals, connectorCounts };
}
