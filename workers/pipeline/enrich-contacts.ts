import { fileURLToPath } from "node:url";
import { createServiceRoleClient } from "@leads/db";
import type { Vertical } from "@leads/core";
import { enrichContactsViaHunter } from "../connectors/optional-paid/hunter.js";
import { enrichContactsViaProspeo } from "../connectors/optional-paid/prospeo.js";
import { enrichContactViaApollo } from "../connectors/optional-paid/apollo.js";
import { rescoreLead } from "./rescore-lead.js";
import { RULES_BY_VERTICAL } from "../scoring/rules-by-vertical.js";
import { normalizeDomain } from "./shared.js";

/**
 * Backfills a named contact for companies that have a website but no contact
 * yet — this is what turns a bare "hiring signal" or "launch post" into
 * something with a real person to reach out to.
 *
 * Providers run cheapest-first and stop at the first hit: Hunter (has a free
 * tier), then Prospeo, then Apollo last because its match/reveal call spends
 * a credit per lead. Each self-disables when its key is unset, so the chain
 * just gets shorter rather than erroring.
 */
export async function enrichMissingContacts(vertical?: Vertical): Promise<number> {
  const supabase = createServiceRoleClient();

  let leadsQuery = supabase
    .from("leads")
    .select("id, vertical, primary_contact_id, company:companies!leads_company_id_fkey(id, website)")
    .is("primary_contact_id", null);
  if (vertical) leadsQuery = leadsQuery.eq("vertical", vertical);

  const { data: candidates } = await leadsQuery;
  let enrichedCount = 0;

  for (const lead of candidates ?? []) {
    const company = lead.company as unknown as { id: string; website: string | null } | null;
    if (!company?.website) continue;

    const domain = normalizeDomain(company.website);
    if (!domain) continue;

    let contacts = await enrichContactsViaHunter(domain);
    if (contacts.length === 0) contacts = await enrichContactsViaProspeo(domain);
    if (contacts.length === 0) {
      const apolloContact = await enrichContactViaApollo(domain);
      if (apolloContact) contacts = [apolloContact];
    }
    if (contacts.length === 0) continue;

    let firstContactId: string | null = null;
    for (const [i, contact] of contacts.entries()) {
      const { data: inserted } = await supabase
        .from("contacts")
        .insert({
          company_id: company.id,
          name: contact.name,
          job_title: contact.title,
          contact_method: contact.contactMethod,
          contact_value: contact.contactValue,
          source: contact.contactMethod,
        })
        .select("id")
        .single();
      if (inserted && i === 0) firstContactId = inserted.id;
    }

    if (firstContactId) {
      await supabase.from("leads").update({ primary_contact_id: firstContactId }).eq("id", lead.id);
    }

    const rules = RULES_BY_VERTICAL[lead.vertical as Vertical];
    const { score, tier } = await rescoreLead(supabase, lead.id, lead.vertical as Vertical, rules);
    enrichedCount++;
    console.log(
      `[enrich] company ${company.id}: found ${contacts.length} contact(s) via ${contacts[0].contactMethod}, rescored to [${score}] ${tier}`
    );
  }

  return enrichedCount;
}

async function main() {
  const vertical = process.argv[2] as Vertical | undefined;
  const count = await enrichMissingContacts(vertical);
  console.log(`Enriched ${count} lead(s) with a contact.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
