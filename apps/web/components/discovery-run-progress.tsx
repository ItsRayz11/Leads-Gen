import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import type { ConnectorState, RunState } from "../lib/hooks/use-discovery-run";

const STATUS_ICON: Record<ConnectorState["status"], string> = {
  running: "⟳",
  done: "✓",
  error: "✕",
  skipped: "–",
};

function ConnectorRow({ state }: { state: ConnectorState }) {
  return (
    <li className="flex items-start gap-2 py-1">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 w-3 shrink-0 text-center font-mono text-xs",
          state.status === "running" && "animate-spin text-primary",
          state.status === "done" && "text-success",
          state.status === "error" && "text-destructive",
          state.status === "skipped" && "text-muted-foreground"
        )}
      >
        {STATUS_ICON[state.status]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground">{state.connector}</span>
        {state.status === "done" && (
          <span className="text-muted-foreground"> &mdash; {state.signalsFound} signal(s)</span>
        )}
        {state.status === "running" && <span className="text-muted-foreground"> &mdash; searching&hellip;</span>}
        {state.status === "skipped" && (
          <span className="text-muted-foreground"> &mdash; skipped ({state.note})</span>
        )}
        {state.note && state.status === "done" && <span className="block text-warning">{state.note}</span>}
        {state.error && <span className="block break-words text-destructive">{state.error}</span>}
      </span>
    </li>
  );
}

/** Renders one run's live progress — stages reached, per-connector status, leads found so far, and the final result. */
export function DiscoveryRunProgress({ run }: { run: RunState }) {
  const active = !run.finished;
  const failedConnectors = run.connectors.filter((c) => c.status === "error").length;
  const result = run.result;

  return (
    <div
      className={cn(
        "space-y-3 rounded-md border p-3 text-xs",
        run.error ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30"
      )}
    >
      <ol className="space-y-0.5" aria-live="polite" aria-busy={active ? "true" : "false"}>
        {run.stages.map((s, i) => {
          const pending = i === run.stages.length - 1 && active;
          return (
            <li key={`${s.stage}-${i}`} className="flex items-start gap-2">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 w-3 shrink-0 text-center font-mono",
                  pending ? "animate-spin text-primary" : "text-success"
                )}
              >
                {pending ? "⟳" : "✓"}
              </span>
              <span className="text-foreground">{s.message}</span>
            </li>
          );
        })}
      </ol>

      {run.connectors.length > 0 && (
        <div>
          <p className="mb-1 font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
          <ul className="divide-y divide-border/60">
            {run.connectors.map((c, i) => (
              <ConnectorRow key={`${c.connector}-${i}`} state={c} />
            ))}
          </ul>
        </div>
      )}

      {run.leads.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="font-medium uppercase tracking-wide text-muted-foreground">Leads</p>
            <span className="text-muted-foreground">
              {run.leads.length}
              {run.leadTotal > 0 && ` / ${run.leadTotal}`}
            </span>
          </div>
          {run.leadTotal > 0 && (
            <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.round((run.leads.length / run.leadTotal) * 100)}%` }}
              />
            </div>
          )}
          <ul className="space-y-0.5 text-muted-foreground">
            {run.leads
              .slice()
              .sort((a, b) => b.score - a.score)
              .slice(0, 10)
              .map((l) => (
                <li key={l.companyName}>
                  [{l.score}] {l.companyName}
                </li>
              ))}
            {run.leads.length > 10 && <li>&hellip;and {run.leads.length - 10} more</li>}
          </ul>
        </div>
      )}

      {run.error && <p className="text-destructive">{run.error}</p>}

      {result && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <Badge
            variant={
              result.status === "failed"
                ? "destructive"
                : result.status === "completed_with_warnings"
                  ? "warning"
                  : "success"
            }
          >
            {(result.status ?? "completed").replace(/_/g, " ")}
          </Badge>
          <span className="text-foreground">
            {result.signalsFound} signal(s) found, {result.leadsUpserted.length} lead(s) upserted
            {failedConnectors > 0 && `, ${failedConnectors} source(s) failed`}
          </span>
          {result.note && <span className="w-full text-warning">{result.note}</span>}
        </div>
      )}
    </div>
  );
}
