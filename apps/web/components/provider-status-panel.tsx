import type { ProviderStatus } from "../lib/data/providers";
import { Badge } from "./ui/badge";

const CAPABILITY_LABELS: { key: keyof ProviderStatus["capabilities"]; label: string }[] = [
  { key: "industry", label: "Industry" },
  { key: "geography", label: "Geography" },
  { key: "jobTitle", label: "Job title" },
  { key: "companySize", label: "Company size" },
];

function CapabilityChip({
  supported,
  label,
  note,
}: {
  supported: boolean;
  label: string;
  note?: string;
}) {
  return (
    <span
      title={note ?? (supported ? `${label}: supported` : `${label}: not supported by this source`)}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${
        supported
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-transparent text-muted-foreground"
      }`}
    >
      {label} {supported ? "✓" : "✕"}
    </span>
  );
}

const VERTICAL_LABELS: Record<string, string> = {
  hiring: "Hiring signals",
  general: "General (HN)",
  card_affiliate: "Card affiliate",
};

export function ProviderStatusPanel({ statuses }: { statuses: ProviderStatus[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Vertical</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Capabilities</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((s) => (
            <tr key={s.connector} className="border-b border-border last:border-0 hover:bg-accent/40">
              <td className="px-3 py-2 font-medium">{s.label}</td>
              <td className="px-3 py-2 text-muted-foreground">{VERTICAL_LABELS[s.vertical] ?? s.vertical}</td>
              <td className="px-3 py-2">
                <Badge variant={s.configured ? "success" : "outline"}>
                  {s.configured ? "Ready" : "Not configured"}
                </Badge>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.reason}</p>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {CAPABILITY_LABELS.map(({ key, label }) => (
                    <CapabilityChip
                      key={key}
                      label={label}
                      supported={s.capabilities[key].supported}
                      note={s.capabilities[key].note}
                    />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
