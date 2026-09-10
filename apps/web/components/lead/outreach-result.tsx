"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input, Select } from "../ui/input";

export const OUTREACH_STATUSES = ["draft", "sent", "replied", "no_response", "bounced"] as const;

/**
 * Records what came back from an outreach attempt. Status is saved on change,
 * the free-text result on blur, so neither needs a save button in a table row.
 */
export function OutreachResultControl({
  outreachId,
  status,
  result,
  compact = false,
}: {
  outreachId: string;
  status: string;
  result: string | null;
  compact?: boolean;
}) {
  const [statusValue, setStatusValue] = useState(status);
  const [resultValue, setResultValue] = useState(result ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/outreach/${outreachId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "space-y-1" : "flex flex-wrap items-center gap-2"}>
      <Select
        value={statusValue}
        disabled={saving}
        className="w-32"
        title="Outreach result"
        onChange={(e) => {
          setStatusValue(e.target.value);
          save({ status: e.target.value });
        }}
      >
        {OUTREACH_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </Select>
      <Input
        placeholder="Result note"
        value={resultValue}
        disabled={saving}
        className={compact ? "w-full" : "w-56"}
        onChange={(e) => setResultValue(e.target.value)}
        onBlur={() => {
          if ((resultValue.trim() || null) !== (result ?? null)) save({ result: resultValue });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
