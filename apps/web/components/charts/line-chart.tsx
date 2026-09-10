export interface LineChartPoint {
  label: string;
  value: number;
}

const WIDTH = 640;
const HEIGHT = 160;
const PADDING_X = 8;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 24;

/**
 * Single-series trend line with an area wash underneath, per the data-viz
 * method's "trend over time" rule (one sequential hue). End value is
 * direct-labeled; a hover tooltip on each point is a native SVG <title> —
 * enough for a single series without adding client-side tooltip state.
 */
export function LineChart({ data }: { data: LineChartPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const plotWidth = WIDTH - PADDING_X * 2;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: PADDING_X + i * stepX,
    y: PADDING_TOP + plotHeight - (d.value / max) * plotHeight,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PADDING_TOP + plotHeight} L ${points[0].x} ${
    PADDING_TOP + plotHeight
  } Z`;

  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Trend line chart">
      <line
        x1={PADDING_X}
        y1={PADDING_TOP + plotHeight}
        x2={WIDTH - PADDING_X}
        y2={PADDING_TOP + plotHeight}
        className="stroke-border"
        strokeWidth={1}
      />
      <path d={areaPath} className="fill-primary" opacity={0.1} />
      <path d={linePath} className="stroke-primary" strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r={4} className="fill-primary stroke-card" strokeWidth={2}>
          <title>{`${p.label}: ${p.value}`}</title>
        </circle>
      ))}
      <text x={last.x} y={last.y - 10} textAnchor="end" className="fill-foreground text-[10px] font-medium">
        {last.value}
      </text>
      <text x={PADDING_X} y={HEIGHT - 6} className="fill-muted-foreground text-[9px]">
        {data[0].label}
      </text>
      <text x={WIDTH - PADDING_X} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[9px]">
        {data[data.length - 1].label}
      </text>
    </svg>
  );
}
