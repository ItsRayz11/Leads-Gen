import {
  DIMENSION_COLUMNS,
  DIMENSION_HINTS,
  DIMENSION_LABELS,
  SCORE_DIMENSIONS,
  type ScoreDimension,
} from "@leads/core";

/** Just the dimension columns off a `lead_scores` row. */
type ScoreRow = Record<string, unknown>;

function scoreFor(row: ScoreRow, dimension: ScoreDimension): number | null {
  const value = row[DIMENSION_COLUMNS[dimension]];
  return typeof value === "number" ? value : null;
}

function barClass(score: number): string {
  if (score >= 70) return "bg-success";
  if (score >= 40) return "bg-primary";
  if (score > 0) return "bg-warning";
  return "bg-destructive";
}

/**
 * The per-dimension scores behind a lead's overall number.
 *
 * A dimension the vertical does not measure reads "not measured" rather than
 * zero — a "general" lead has no funding or headcount data to judge, and
 * showing that as 0 would look like a finding when it is an absence of one.
 */
export function ScoreDimensions({
  score,
  tierLimitedBy,
}: {
  score: ScoreRow;
  /** Set when a gate held the tier below what the overall score alone gives. */
  tierLimitedBy?: string | null;
}) {
  const measured = SCORE_DIMENSIONS.map((dimension) => ({
    dimension,
    value: scoreFor(score, dimension),
  }));

  // Nothing to show for a row written before dimensions were scored, or for a
  // human override, which sets an overall number and no dimensions.
  if (measured.every((d) => d.value === null)) return null;

  return (
    <div className="space-y-2">
      {measured.map(({ dimension, value }) => (
        <div key={dimension} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-2">
          <span className="text-xs text-muted-foreground" title={DIMENSION_HINTS[dimension]}>
            {DIMENSION_LABELS[dimension]}
          </span>
          {value === null ? (
            <span className="text-xs italic text-muted-foreground/70">
              not measured for this vertical
            </span>
          ) : (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${barClass(value)}`} style={{ width: `${value}%` }} />
            </div>
          )}
          <span className="text-right text-xs tabular-nums text-muted-foreground">
            {value === null ? "—" : value}
          </span>
        </div>
      ))}

      {tierLimitedBy && (
        <p className="text-xs text-warning">Tier held below its score: {tierLimitedBy}.</p>
      )}
    </div>
  );
}
