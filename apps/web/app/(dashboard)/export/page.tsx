import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Select } from "../../../components/ui/input";

const VERTICALS = ["hiring", "general", "card_affiliate"];
const TIERS = ["A+", "A", "B", "C", "Low Priority"];
const STATUSES = [
  "new", "researching", "qualified", "contacted", "follow_up", "replied",
  "meeting", "negotiation", "won",
  "no_response", "rejected", "not_interested", "not_a_fit", "lost", "on_hold",
];

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Export Leads</h1>
        <p className="text-sm text-muted-foreground">
          Export leads to CSV, optionally filtered by vertical, status, or tier.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" action="/api/export" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Vertical</label>
              <Select name="vertical" defaultValue="">
                <option value="">All</option>
                {VERTICALS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select name="status" defaultValue="">
                <option value="">All</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tier</label>
              <Select name="tier" defaultValue="">
                <option value="">All</option>
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" size="sm">
              Download CSV
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
