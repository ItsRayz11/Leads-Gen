import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { createClient } from "../../../lib/supabase/server";

export interface SearchCompanyResult {
  id: string;
  name: string;
  domain: string | null;
}

export interface SearchLeadResult {
  id: string;
  title: string;
  vertical: string;
  status: string;
  companyName: string;
}

export interface SearchContactResult {
  id: string;
  name: string;
  job_title: string | null;
  company: { name: string } | null;
}

export interface SearchResponse {
  companies: SearchCompanyResult[];
  leads: SearchLeadResult[];
  contacts: SearchContactResult[];
}

/**
 * Backs the command palette. Companies are the primary match (name is the
 * identity most people search by); leads are surfaced by way of a company
 * match rather than by lead title, since every lead in a vertical shares the
 * same generic title (e.g. "Hiring signal opportunity") and isn't itself
 * searchable text.
 */
export async function GET(req: NextRequest) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ companies: [], leads: [], contacts: [] } satisfies SearchResponse);
  }

  const supabase = await createClient();
  const like = `%${q}%`;

  const [companiesRes, contactsRes] = await Promise.all([
    supabase.from("companies").select("id, name, domain").ilike("name", like).order("name").limit(5),
    supabase
      .from("contacts")
      .select("id, name, job_title, company:companies ( name )")
      .ilike("name", like)
      .order("name")
      .limit(5),
  ]);

  if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 500 });
  if (contactsRes.error) return NextResponse.json({ error: contactsRes.error.message }, { status: 500 });

  const companies = (companiesRes.data ?? []) as SearchCompanyResult[];
  const companyIds = companies.map((c) => c.id);

  let leads: SearchLeadResult[] = [];
  if (companyIds.length > 0) {
    const { data: leadRows, error: leadsError } = await supabase
      .from("leads")
      .select("id, title, vertical, status, company:companies ( name )")
      .in("company_id", companyIds)
      .limit(8);
    if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 });
    leads = (leadRows ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      vertical: l.vertical,
      status: l.status,
      companyName: (l.company as { name: string } | null)?.name ?? "Unknown company",
    }));
  }

  const contacts = (contactsRes.data ?? []) as unknown as SearchContactResult[];

  return NextResponse.json({ companies, leads, contacts } satisfies SearchResponse);
}
