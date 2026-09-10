import { createClient } from "../supabase/server";
import type { TaskStatus } from "@leads/db/types.js";

export interface TaskFilters {
  status?: string;
}

export interface TaskListRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  lead: { id: string; title: string; company: { name: string } | null } | null;
  company: { id: string; name: string } | null;
  contact: { id: string; name: string | null } | null;
}

const TASK_SELECT = `
  id, title, status, priority, due_date, notes, created_at,
  lead:leads ( id, title, company:companies ( name ) ),
  company:companies ( id, name ),
  contact:contacts ( id, name )
`;

export async function listTasks(filters: TaskFilters = {}): Promise<TaskListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status as TaskStatus);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TaskListRow[];
}
