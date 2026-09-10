"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "../ui/input";

export function FollowUpInput({ leadId, value }: { leadId: string; value: string | null }) {
  const [date, setDate] = useState(value ? value.slice(0, 10) : "");
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function save(next: string) {
    setDate(next);
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_follow_up_at: next || null }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <Input type="date" value={date} onChange={(e) => save(e.target.value)} className="w-40" />
  );
}
