import {
  AI_USE_CASES,
  AI_USE_CASE_LABELS,
  listAiProviderSettings,
  resolveUseCaseStatus,
} from "../../../lib/data/ai-settings";
import { getProviderKeyReport } from "../../../lib/data/integrations";
import { listScoringConfig } from "../../../lib/data/scoring-config";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { AiProviderSettingsForm } from "../../../components/ai-provider-settings-form";
import { TaskRoutingForm } from "../../../components/task-routing-form";
import { TestConnectionButton } from "../../../components/test-connection-button";
import { ScoringConfigForm } from "../../../components/scoring-config-form";
import { formatDateTime } from "../../../lib/utils";
import { VERTICAL_LABELS } from "../../../lib/lead-options";
import type { ScoreDimension } from "@leads/core";

export default async function SettingsPage() {
  const [settings, scoringConfig, { status: keyStatus, storeUnavailable }] = await Promise.all([
    listAiProviderSettings(),
    listScoringConfig(),
    getProviderKeyReport(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI task routing</CardTitle>
          <p className="text-sm text-muted-foreground">
            Three use cases are actually called by this app: search interpretation (turning a natural-language
            Discovery search into structured filters), lead qualification (a lead&apos;s &quot;Assess with AI&quot;
            button), and outreach drafting (the per-message &quot;Generate with AI&quot; button). Adding a key on the{" "}
            <span className="text-foreground">Integrations</span> page only stores the key — a task only uses AI
            once you assign a provider to it here.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {storeUnavailable && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-medium text-warning">Keys saved on the Integrations page can&apos;t be read</p>
              <p className="mt-1 text-muted-foreground">{storeUnavailable}</p>
              <p className="mt-1 text-muted-foreground">
                Assignments below will report &ldquo;no key configured&rdquo; for any provider whose key lives in the
                database rather than an environment variable.
              </p>
            </div>
          )}
          {AI_USE_CASES.map((useCase) => (
            <TaskRoutingForm
              key={useCase}
              useCase={useCase}
              label={AI_USE_CASE_LABELS[useCase]}
              status={resolveUseCaseStatus(useCase, settings, keyStatus)}
              keyStatus={keyStatus}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Providers — all rows</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every row behind the task routing above, plus room to add extra fallback providers per use case
            (lower priority number = tried first).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
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
