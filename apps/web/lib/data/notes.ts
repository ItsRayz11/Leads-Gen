import { createClient } from "../supabase/server";

export interface NoteListRow {
  id: string;
  body: string;
  created_at: string;
  lead: { id: string; title: string } | null;
  company: { id: string; name: string } | null;
  contact: { id: string; name: string | null } | null;
}

const NOTE_SELECT = `
  id, body, created_at,
  lead:leads ( id, title ),
  company:companies ( id, name ),
  contact:contacts ( id, name )
`;

export async function listNotes(): Promise<NoteListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as NoteListRow[];
}
