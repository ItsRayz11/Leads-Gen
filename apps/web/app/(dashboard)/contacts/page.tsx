import Link from "next/link";
import { listContacts } from "../../../lib/data/contacts";
import { Badge } from "../../../components/ui/badge";
import { formatDate } from "../../../lib/utils";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const contacts = await listContacts(params);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">{contacts.length} contacts</p>
        </div>
      </div>

      <form className="flex gap-2">
        <Input name="q" defaultValue={params.q ?? ""} placeholder="Search by name…" className="max-w-xs" />
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Verification</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No contacts yet. Run a discovery pipeline or import your legacy CSV.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link href={`/contacts/${c.id}`} className="font-medium hover:text-primary">
                      {c.name ?? "Unnamed"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{c.job_title ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.company ? (
                      <Link href={`/companies/${c.company.id}`} className="hover:text-primary">
                        {c.company.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.contact_method ? (
                      <>
                        <span className="text-xs uppercase text-muted-foreground/70">{c.contact_method}</span>
                        <div>{c.contact_value ?? c.email ?? "—"}</div>
                      </>
                    ) : (
                      c.email ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{c.verification_status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(c.updated_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
