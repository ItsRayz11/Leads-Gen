import { listAiProviderSettings } from "../../../lib/data/ai-settings";
import { listScoringConfig } from "../../../lib/data/scoring-config";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { AiProviderSettingsForm } from "../../../components/ai-provider-settings-form";
import { TestConnectionButton } from "../../../components/test-connection-button";
import { ScoringConfigForm } from "../../../components/scoring-config-form";
import { formatDateTime } from "../../../lib/utils";
import { VERTICAL_LABELS } from "../../../lib/lead-options";
import type { ScoreDimension } from "@leads/core";

export default async function SettingsPage() {
  const [settings, scoringConfig] = await Promise.all([listAiProviderSettings(), listScoringConfig()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Three use cases are actually called by this app:{" "}
            <code className="text-foreground">outreach_drafting</code> (the per-message "Generate with AI" button),{" "}
            <code className="text-foreground">lead_qualification</code> (a lead's "Assess with AI" button), and{" "}
            <code className="text-foreground">search_interpretation</code> (turning a natural-language search into
            structured filters). Each is resolved independently by priority, and any use case without an enabled row
            whose API key is present in the environment degrades to an honest error or a keyword fallback rather than
            a fabricated result.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Use case</th>
                  <th className="px-3 py-2">Enabled</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Last test</th>
                  <th className="px-3 py-2">Connection</th>
                </tr>
              </thead>
              <tbody>
                {settings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      No AI provider settings yet.
                    </td>
                  </tr>
                ) : (
                  settings.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{s.provider}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.model ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {s.use_case ? s.use_case.replace(/_/g, " ") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={s.enabled ? "success" : "outline"}>
                          {s.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{s.priority}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {s.last_test_status ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant={s.last_test_status === "ok" ? "success" : "destructive"}>
                              {s.last_test_status}
                            </Badge>
                            <span className="text-xs">{formatDateTime(s.last_tested_at)}</span>
                          </div>
                        ) : (
                          "Never tested"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <TestConnectionButton id={s.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <AiProviderSettingsForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scoring weights & tier cutoffs</CardTitle>
          <p className="text-sm text-muted-foreground">
            How much each dimension counts toward a lead&apos;s overall score, and the score a lead needs to reach
            each tier — per vertical. Rule definitions (which signals earn points) stay in code; only these numbers
            are editable here. Changes apply the next time a lead in that vertical is scored or re-scored.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {scoringConfig.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scoring config rows found — run the latest migration to seed the defaults.
            </p>
          ) : (
            scoringConfig.map((config) => (
              <div key={config.vertical} className="space-y-2 border-b border-border pb-6 last:border-0 last:pb-0">
                <p className="text-sm font-medium">
                  {VERTICAL_LABELS[config.vertical as keyof typeof VERTICAL_LABELS] ?? config.vertical}
                </p>
                <ScoringConfigForm
                  vertical={config.vertical}
                  dimensionWeights={config.dimension_weights as Partial<Record<ScoreDimension, number>>}
                  tierThresholds={config.tier_thresholds as { tier: string; min: number }[]}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Lead Intelligence Workspace — a private, single-user Lead Intelligence + CRM + Outreach app.</p>
        </CardContent>
      </Card>
    </div>
  );
}
