export interface BarChartDatum {
  label: string;
  value: number;
}

const BAR_THICKNESS = 16;
const ROW_GAP = 10;
const ROW_HEIGHT = BAR_THICKNESS + ROW_GAP;
const LABEL_WIDTH = 120;
const PLOT_WIDTH = 320;
const VALUE_GUTTER = 40;

/**
 * Horizontal bar chart for ranked magnitude comparisons (status/tier/vertical/
 * country counts). One sequential hue per the data-viz method's "compare
 * magnitude" rule — these are ranked counts, not distinct series, so
 * categorical color would be the wrong job. Every bar carries its value
 * directly at the tip, so no separate value axis is drawn.
 */
export function BarChart({ data, formatLabel }: { data: BarChartDatum[]; formatLabel?: (label: string) => string }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const height = data.length * ROW_HEIGHT;
  const width = LABEL_WIDTH + PLOT_WIDTH + VALUE_GUTTER;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const barLength = Math.max((d.value / max) * PLOT_WIDTH, d.value > 0 ? 3 : 0);
        const y = i * ROW_HEIGHT;
        return (
          <g key={d.label}>
            <title>{`${formatLabel ? formatLabel(d.label) : d.label}: ${d.value}`}</title>
            <text
              x={LABEL_WIDTH - 8}
              y={y + BAR_THICKNESS / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {formatLabel ? formatLabel(d.label) : d.label}
            </text>
            <rect x={LABEL_WIDTH} y={y} width={barLength} height={BAR_THICKNESS} rx={4} className="fill-primary" />
            <text
              x={LABEL_WIDTH + barLength + 6}
              y={y + BAR_THICKNESS / 2}
              dominantBaseline="middle"
              className="fill-foreground text-[10px] font-medium"
            >
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
