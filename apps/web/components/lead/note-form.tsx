"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Textarea } from "../ui/input";
import { Button } from "../ui/button";

interface NoteFormProps {
  leadId?: string;
  companyId?: string;
  contactId?: string;
}

export function NoteForm({ leadId, companyId, contactId }: NoteFormProps) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, companyId, contactId, body }),
    });
    setBody("");
    startTransition(() => router.refresh());
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
      <Textarea
        rows={2}
        placeholder="Add a note…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={pending || !body.trim()}>
        Add note
      </Button>
    </form>
  );
}
