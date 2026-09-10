"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

interface TaskFormProps {
  leadId?: string;
  companyId?: string;
  contactId?: string;
}

export function TaskForm({ leadId, companyId, contactId }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, companyId, contactId, title, dueDate }),
    });
    setTitle("");
    setDueDate("");
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input placeholder="New task…" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-40" />
      <Button type="submit" size="sm" disabled={pending || !title.trim()}>
        Add
      </Button>
    </form>
  );
}

export function TaskStatusToggle({ id, status }: { id: string; status: string }) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    const next = status === "completed" ? "pending" : "completed";
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <input type="checkbox" checked={status === "completed"} onChange={toggle} className="h-4 w-4 rounded" />
  );
}
