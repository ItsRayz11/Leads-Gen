import { createClient } from "../supabase/server";
import type { VerificationStatus } from "@leads/db/types.js";

export interface ContactFilters {
  q?: string;
  verificationStatus?: string;
}

export interface ContactListRow {
  id: string;
  name: string | null;
  job_title: string | null;
  contact_method: string | null;
  contact_value: string | null;
  email: string | null;
  verification_status: string;
  updated_at: string;
  company: { id: string; name: string } | null;
}

const CONTACT_SELECT = `
  id, name, job_title, contact_method, contact_value, email, verification_status, updated_at,
  company:companies ( id, name )
`;

export async function listContacts(filters: ContactFilters = {}): Promise<ContactListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select(CONTACT_SELECT)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.verificationStatus)
    query = query.eq("verification_status", filters.verificationStatus as VerificationStatus);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ContactListRow[];
}

export async function getContactDetail(id: string) {
  const supabase = await createClient();

  const [contactRes, leadsRes, outreachRes, notesRes, activitiesRes] = await Promise.all([
    supabase.from("contacts").select("*, company:companies(*)").eq("id", id).single(),
    supabase
      .from("leads")
      .select("*, company:companies!leads_company_id_fkey(id, name)")
      .eq("primary_contact_id", id)
      .order("updated_at", { ascending: false }),
    supabase.from("outreach").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
    supabase.from("notes").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
    supabase.from("activities").select("*").eq("contact_id", id).order("occurred_at", { ascending: false }),
  ]);

  if (contactRes.error) throw contactRes.error;

  return {
    contact: contactRes.data,
    leads: leadsRes.data ?? [],
    outreach: outreachRes.data ?? [],
    notes: notesRes.data ?? [],
    activities: activitiesRes.data ?? [],
  };
}
