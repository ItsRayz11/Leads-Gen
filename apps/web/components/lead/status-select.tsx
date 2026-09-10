"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Select } from "../ui/input";
import { LEAD_STATUSES } from "../../lib/lead-options";

export function StatusSelect({ leadId, status }: { leadId: string; status: string }) {
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onChange(next: string) {
    setValue(next);
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <Select value={value} disabled={pending} onChange={(e) => onChange(e.target.value)}>
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, " ")}
        </option>
      ))}
    </Select>
  );
}
