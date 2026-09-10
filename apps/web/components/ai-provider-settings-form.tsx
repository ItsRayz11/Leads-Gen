"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";

const PROVIDERS = ["openai", "anthropic", "google", "openrouter"];
const USE_CASES = [
  "lead_research",
  "lead_scoring",
  "lead_qualification",
  "search_interpretation",
  "outreach_drafting",
];

export function AiProviderSettingsForm() {
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [model, setModel] = useState("");
  const [useCase, setUseCase] = useState(USE_CASES[0]);
  const [enabled, setEnabled] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/ai-provider-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, use_case: useCase, enabled }),
    });
    setModel("");
    setEnabled(false);
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Provider</label>
        <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Model</label>
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="e.g. gpt-4o, claude-sonnet-5"
          className="w-48"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Use case</label>
        <Select value={useCase} onChange={(e) => setUseCase(e.target.value)}>
          {USE_CASES.map((u) => (
            <option key={u} value={u}>
              {u.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        Enabled
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        Add
      </Button>
    </form>
  );
}
