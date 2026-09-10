"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../ui/button";
import { Input, Select } from "../ui/input";
import { VERIFICATION_STATUSES, humanize } from "../../lib/lead-options";

/**
 * Sets a lead's verification status. The note is optional and lands on the
 * activity timeline, so "verified" always carries a record of who decided it
 * and why — and marking a lead verified stamps verified_at on its evidence.
 */
export function VerificationControl({
  leadId,
  status,
}: {
  leadId: string;
  status: string;
}) {
  const [value, setValue] = useState(status);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const dirty = value !== status;

  async function save(next: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_status: next, verificationNote: note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save the verification.");
        return;
      }
      setValue(next);
      setNote("");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        title="Verification status"
      >
        {VERIFICATION_STATUSES.map((v) => (
          <option key={v} value={v}>
            {humanize(v)}
          </option>
        ))}
      </Select>

      {dirty && (
        <>
          <Input
            placeholder="What did you check? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-64"
          />
          <Button type="button" size="sm" disabled={saving} onClick={() => save(value)}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => {
              setValue(status);
              setNote("");
            }}
          >
            Cancel
          </Button>
        </>
      )}

      {!dirty && status !== "verified" && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={saving}
          onClick={() => {
            setValue("verified");
            save("verified");
          }}
        >
          Verify lead
        </Button>
      )}

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
