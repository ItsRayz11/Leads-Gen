import Link from "next/link";
import { listCompanies } from "../../../lib/data/companies";
import { formatDate } from "../../../lib/utils";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Pager } from "../../../components/ui/pager";
import { queryString, resolvePage, resolvePerPage, single, type SearchParams } from "../../../lib/paging";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = single(params, "q");
  const page = resolvePage(single(params, "page"));
  const perPage = resolvePerPage(single(params, "perPage"));

  const { rows: companies, total } = await listCompanies(
    { q, country: single(params, "country"), industry: single(params, "industry") },
    { page, perPage }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">
            {total} compan{total === 1 ? "y" : "ies"}
          </p>
        </div>
      </div>

      <form className="flex gap-2">
        <Input name="q" defaultValue={q ?? ""} placeholder="Search by name…" className="max-w-xs" />
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Website</th>
              <th className="px-3 py-2">Country</th>
              <th className="px-3 py-2">Industry</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Open Leads</th>
              <th className="px-3 py-2">Contacts</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  {q
                    ? "No companies match that search."
                    : "No companies yet. Run a discovery pipeline or import your legacy CSV."}
                </td>
              </tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link href={`/companies/${c.id}`} className="font-medium hover:text-primary">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.website ? (
                      <a href={c.website} target="_blank" rel="noreferrer" className="hover:text-primary">
                        {c.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{c.country ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.industry ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.company_size ?? "—"}</td>
                  <td className="px-3 py-2">{c.open_leads_count}</td>
                  <td className="px-3 py-2">{c.contacts_count}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(c.updated_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager
        basePath="/companies"
        searchParams={queryString(params)}
        page={page}
        perPage={perPage}
        total={total}
        rowsOnPage={companies.length}
        noun={{ one: "company", many: "companies" }}
      />
    </div>
  );
}
