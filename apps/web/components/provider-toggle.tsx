"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ProviderToggle({
  providerName,
  category,
  enabled,
  priority,
  disabled,
}: {
  providerName: string;
  category: "lead_data" | "ai";
  enabled: boolean;
  priority: number;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onChange(next: boolean) {
    setValue(next);
    await fetch("/api/provider-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_name: providerName, category, enabled: next, priority }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={value}
        disabled={disabled || pending}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary disabled:opacity-50"
      />
      {value ? "Enabled" : "Disabled"}
    </label>
  );
}
