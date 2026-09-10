import Link from "next/link";
import { listNotes, type NoteListRow } from "../../../lib/data/notes";
import { formatDateTime } from "../../../lib/utils";

function linkedEntity(note: NoteListRow): { href: string; label: string } | null {
  if (note.lead) return { href: `/leads/${note.lead.id}`, label: note.lead.title };
  if (note.company) return { href: `/companies/${note.company.id}`, label: note.company.name };
  if (note.contact) return { href: `/contacts/${note.contact.id}`, label: note.contact.name ?? "Contact" };
  return null;
}

export default async function NotesPage() {
  const notes = await listNotes();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Notes</h1>
        <p className="text-sm text-muted-foreground">{notes.length} notes across the workspace</p>
      </div>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          notes.map((note) => {
            const entity = linkedEntity(note);
            return (
              <div key={note.id} className="rounded-lg border border-border p-3 text-sm">
                <p>{note.body}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDateTime(note.created_at)}</span>
                  {entity && (
                    <Link href={entity.href} className="text-primary hover:underline">
                      {entity.label}
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
