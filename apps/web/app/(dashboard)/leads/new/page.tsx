import Link from "next/link";
import { listCompanyOptions } from "../../../../lib/data/companies";
import { LeadForm } from "../../../../components/lead/lead-form";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const companies = await listCompanyOptions();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">New lead</h1>
          <p className="text-sm text-muted-foreground">
            For opportunities you found yourself — the discovery pipeline and CSV import write leads too.
          </p>
        </div>
        <Link href="/leads" className="text-sm text-primary hover:underline">
          Back to leads
        </Link>
      </div>

      <LeadForm
        mode="create"
        companies={companies}
        initial={{
          companyId: single(params, "companyId") ?? "",
          vertical: single(params, "vertical") ?? "general",
        }}
      />
    </div>
  );
}
