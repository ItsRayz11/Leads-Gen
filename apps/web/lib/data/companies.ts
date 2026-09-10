import { createClient } from "../supabase/server";

export interface CompanyFilters {
  q?: string;
  country?: string;
  industry?: string;
}

export interface CompanyListRow {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  industry: string | null;
  country: string | null;
  company_size: string | null;
  updated_at: string;
  open_leads_count: number;
  contacts_count: number;
}

const CLOSED_LEAD_STATUSES = [
  "won",
  "lost",
  "rejected",
  "not_interested",
  "not_a_fit",
  "no_response",
  "on_hold",
];

const COMPANY_SELECT = "id, name, website, domain, industry, country, company_size, updated_at";

export async function listCompanies(filters: CompanyFilters = {}): Promise<CompanyListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.country) query = query.eq("country", filters.country);
  if (filters.industry) query = query.eq("industry", filters.industry);

  const { data: companies, error } = await query;
  if (error) throw error;
  if (!companies || companies.length === 0) return [];

  const companyIds = companies.map((c) => c.id);

  const [leadsRes, contactsRes] = await Promise.all([
    supabase.from("leads").select("id, company_id, status").in("company_id", companyIds),
    supabase.from("contacts").select("id, company_id").in("company_id", companyIds),
  ]);

  const openLeadsCount = new Map<string, number>();
  for (const lead of leadsRes.data ?? []) {
    if (CLOSED_LEAD_STATUSES.includes(lead.status)) continue;
    openLeadsCount.set(lead.company_id, (openLeadsCount.get(lead.company_id) ?? 0) + 1);
  }

  const contactsCount = new Map<string, number>();
  for (const contact of contactsRes.data ?? []) {
    if (!contact.company_id) continue;
    contactsCount.set(contact.company_id, (contactsCount.get(contact.company_id) ?? 0) + 1);
  }

  return companies.map((c) => ({
    ...c,
    open_leads_count: openLeadsCount.get(c.id) ?? 0,
    contacts_count: contactsCount.get(c.id) ?? 0,
  }));
}

export async function getCompanyDetail(id: string) {
  const supabase = await createClient();

  const [companyRes, contactsRes, leadsRes, activitiesRes, notesRes, tasksRes, sourcesRes] = await Promise.all([
    supabase.from("companies").select("*").eq("id", id).single(),
    supabase.from("contacts").select("*").eq("company_id", id).order("updated_at", { ascending: false }),
    supabase
      .from("leads")
      .select("*, primary_contact:contacts!leads_primary_contact_id_fkey(id, name, job_title)")
      .eq("company_id", id)
      .order("updated_at", { ascending: false }),
    supabase.from("activities").select("*").eq("company_id", id).order("occurred_at", { ascending: false }),
    supabase.from("notes").select("*").eq("company_id", id).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").eq("company_id", id).order("due_date", { ascending: true }),
    supabase.from("company_sources").select("*").eq("company_id", id).order("first_seen_at", { ascending: false }),
  ]);

  if (companyRes.error) throw companyRes.error;

  return {
    company: companyRes.data,
    contacts: contactsRes.data ?? [],
    leads: leadsRes.data ?? [],
    activities: activitiesRes.data ?? [],
    notes: notesRes.data ?? [],
    tasks: tasksRes.data ?? [],
    sources: sourcesRes.data ?? [],
  };
}

export interface CompanyOption {
  id: string;
  name: string;
  domain: string | null;
  country: string | null;
}

/** Companies for a picker — name-ordered, no per-company lead/contact counts. */
export async function listCompanyOptions(): Promise<CompanyOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, domain, country")
    .order("name", { ascending: true })
    .limit(2000);

  if (error) throw error;
  return data ?? [];
}
