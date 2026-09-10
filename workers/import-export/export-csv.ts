/**
 * Reconstructs the "Global_Real-Time_High-Quality_Leads_*.csv" report format
 * from the database. Rank and the header stats (qualified leads, named
 * contacts, evidence links, A/A+ count) are computed at export time rather
 * than stored, so they can never drift out of sync with the underlying rows.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { stringify } from "csv-stringify/sync";
import { createServiceRoleClient } from "@leads/db";
import type { Vertical } from "@leads/core";

async function exportVerticalToCsv(vertical: Vertical, outPath: string) {
  const supabase = createServiceRoleClient();

  const { data: rows, error } = await supabase
    .from("leads")
    .select(
      "id, score, tier, buying_signal_summary, recommended_offer, source_type, company:companies!leads_company_id_fkey(name), primary_contact:contacts!leads_primary_contact_id_fkey(name, job_title)"
    )
    .eq("vertical", vertical)
    .order("score", { ascending: false });

  if (error) throw error;
  const leads = (rows ?? []) as unknown as {
    id: string;
    score: number;
    tier: string | null;
    buying_signal_summary: string | null;
    recommended_offer: string | null;
    source_type: string | null;
    company: { name: string } | null;
    primary_contact: { name: string | null; job_title: string | null } | null;
  }[];

  const leadIds = leads.map((l) => l.id);
  const { data: evidenceRows } = leadIds.length
    ? await supabase.from("evidence").select("lead_id, url").in("lead_id", leadIds)
    : { data: [] };

  const qualifiedCount = leads.length;
  const namedContactCount = leads.filter((l) => l.primary_contact?.name).length;
  const evidenceLinkCount = (evidenceRows ?? []).filter((e) => e.url).length;
  const aTierCount = leads.filter((l) => l.tier === "A+" || l.tier === "A").length;

  const outRows: string[][] = [];
  const blank = (n = 12) => new Array(n).fill("");

  outRows.push(blank());
  outRows.push(["", "REAL-TIME HIGH-QUALITY LEAD PACK", ...blank(10)]);
  outRows.push(blank());
  outRows.push(["", `Verified ${new Date().toISOString().slice(0, 10)}`, ...blank(10)]);
  outRows.push(blank());
  outRows.push([
    "",
    `${qualifiedCount}\nQUALIFIED LEADS`,
    "",
    "",
    `${namedContactCount}\nNAMED CONTACTS`,
    "",
    "",
    `${evidenceLinkCount}\nEVIDENCE LINKS`,
    "",
    "",
    `${aTierCount}\nA / A+ LEADS`,
    "",
  ]);
  outRows.push(blank());
  outRows.push(blank());
  outRows.push(blank());
  outRows.push(["", "IMMEDIATE OUTREACH QUEUE", ...blank(10)]);
  outRows.push([
    "",
    "Rank",
    "Tier",
    "Score",
    "Project",
    "Signal",
    "",
    "First Contact",
    "",
    "Recommended Offer",
    "",
    "Source",
  ]);

  leads.forEach((lead, i) => {
    const firstContact = lead.primary_contact?.name
      ? `${lead.primary_contact.name} — ${lead.primary_contact.job_title ?? ""}`
      : "";

    outRows.push([
      "",
      String(i + 1),
      lead.tier ?? "",
      lead.score != null ? String(lead.score) : "",
      lead.company?.name ?? "",
      lead.buying_signal_summary ?? "",
      "",
      firstContact,
      "",
      lead.recommended_offer ?? "",
      "",
      lead.source_type ?? "",
    ]);
  });

  const csvText = stringify(outRows);
  await writeFile(outPath, csvText, "utf-8");
  console.log(`Exported ${qualifiedCount} "${vertical}" leads to ${outPath}`);
}

async function main() {
  const vertical = (process.argv[2] as Vertical) ?? "hiring";
  const outPath = process.argv[3] ?? `export-${vertical}-${Date.now()}.csv`;
  await exportVerticalToCsv(vertical, outPath);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
