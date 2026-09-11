"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import { Badge } from "./ui/badge";
import type { ProviderKeySource } from "../lib/data/integrations";
import { AI_USE_CASE_UNASSIGNED_BEHAVIOUR, type AiUseCase } from "../lib/ai-use-cases";
import type { UseCaseStatus } from "../lib/data/ai-settings";

const PROVIDERS = ["openai", "anthropic", "google", "openrouter", "agentrouter"] as const;
const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI",
  openrouter: "OpenRouter",
  agentrouter: "AgentRouter",
};

/**
 * One row = one use case this app actually calls (search interpretation,
 * lead qualification, outreach drafting). This is the single place that
 * answers "which provider handles this task" — separate from the
 * Integrations page, which only stores keys. Saving here upserts on
 * (use_case, provider) so re-assigning a task never leaves a stale duplicate
 * row behind.
 */
export function TaskRoutingForm({
  useCase,
  label,
  status,
  keyStatus,
}: {
  useCase: AiUseCase;
  label: string;
  status: UseCaseStatus;
  keyStatus: Record<string, ProviderKeySource>;
}) {
  // Default to whatever is already assigned; failing that, the first
  // provider that actually has a key, so "Assign" is one click rather than
  // a pick-then-discover-there-is-no-key round trip.
  const [provider, setProvider] = useState(
    status.provider ?? PROVIDERS.find((p) => keyStatus[p] && keyStatus[p] !== "none") ?? PROVIDERS[0]
  );
  const [model, setModel] = useState(status.model ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const selectedHasKey = keyStatus[provider] && keyStatus[provider] !== "none";

  async function onSave() {
    setError(null);
    const res = await fetch("/api/ai-provider-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, use_case: useCase, model: model || null, enabled: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not save this assignment.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function onDisable() {
    if (!status.provider) return;
    setError(null);
    const res = await fetch("/api/ai-provider-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: status.provider, use_case: useCase, model: status.model, enabled: false }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not disable this assignment.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {status.reason === "ready" && (
          <Badge variant="success">
            Ready — {PROVIDER_NAMES[status.provider!] ?? status.provider} · {status.model ?? "default model"}
          </Badge>
        )}
        {status.reason === "no_key" && (
          <Badge variant="warning">
            Assigned to {PROVIDER_NAMES[status.provider!] ?? status.provider}, but no key is configured — add one
            on the Integrations page.
          </Badge>
        )}
        {status.reason === "not_assigned" && (
          <Badge variant="outline">{AI_USE_CASE_UNASSIGNED_BEHAVIOUR[useCase]}</Badge>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Provider</label>
          <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_NAMES[p]} {keyStatus[p] === "none" ? "(no key)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Model (optional)</label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="leave blank for the default"
            className="w-56"
          />
        </div>
        <Button type="button" size="sm" disabled={pending} onClick={onSave}>
          {status.provider === provider && status.reason === "ready" ? "Update" : "Assign"}
        </Button>
        {status.reason !== "not_assigned" && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onDisable}>
            Disable
          </Button>
        )}
      </div>

      {!selectedHasKey && (
        <p className="text-xs text-muted-foreground">
          {PROVIDER_NAMES[provider]} has no API key yet — add one on the Integrations page before assigning it, or
          this task stays unavailable.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
