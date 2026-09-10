import { describe, expect, it } from "vitest";
import {
  CsvParseError,
  DEFAULT_IMPORT_OPTIONS,
  leadTitleFor,
  normalizeDomain,
  normalizeMapping,
  normalizeOptions,
  parseCsv,
  planImport,
  suggestMapping,
  type ColumnMapping,
  type ImportOptions,
} from "../apps/web/lib/data/csv-import";

// Index signatures so the fake can filter rows by column name the way the
// planner's `.in(column, values)` calls do.
interface FakeCompany extends Record<string, unknown> {
  id: string;
  name: string;
  domain: string | null;
}

interface FakeLead extends Record<string, unknown> {
  company_id: string;
  title: string;
}

/**
 * Stands in for the Supabase client across the three batched lookups
 * planImport makes: companies by domain, companies by name, and the lead
 * titles already on file at those companies. Only `from().select().in()` is
 * exercised, because that is all the planner uses — it writes nothing.
 */
function fakeClient(seed: { companies?: FakeCompany[]; leads?: FakeLead[] } = {}) {
  const companies = seed.companies ?? [];
  const leads = seed.leads ?? [];

  const client = {
    from(table: string) {
      const rows: Record<string, unknown>[] = table === "companies" ? companies : leads;
      return {
        select() {
          return {
            in(column: string, values: unknown[]) {
              return Promise.resolve({
                data: rows.filter((row) => values.includes(row[column])),
                error: null,
              });
            },
          };
        },
      };
    },
  };

  return client as unknown as Parameters<typeof planImport>[0];
}

function options(overrides: Partial<ImportOptions> = {}): ImportOptions {
  return { ...DEFAULT_IMPORT_OPTIONS, ...overrides };
}

/** Parses a CSV, auto-maps it, and plans it — the wizard's happy path. */
async function plan(
  csv: string,
  seed: Parameters<typeof fakeClient>[0] = {},
  overrides: Partial<ImportOptions> = {},
  mappingOverride?: ColumnMapping
) {
  const parsed = parseCsv(csv);
  const mapping = mappingOverride ?? suggestMapping(parsed.headers);
  return planImport(fakeClient(seed), parsed, mapping, options(overrides));
}

describe("parseCsv", () => {
  it("reads headers and rows", () => {
    const { headers, records } = parseCsv("Company,Website\nAcme,acme.com\nGlobex,globex.com");
    expect(headers).toEqual(["Company", "Website"]);
    expect(records).toEqual([
      { Company: "Acme", Website: "acme.com" },
      { Company: "Globex", Website: "globex.com" },
    ]);
  });

  it("trims whitespace from headers and values", () => {
    const { headers, records } = parseCsv("  Company  , Website \n  Acme , acme.com ");
    expect(headers).toEqual(["Company", "Website"]);
    expect(records[0]).toEqual({ Company: "Acme", Website: "acme.com" });
  });

  it("strips a UTF-8 BOM from the first header", () => {
    const { headers } = parseCsv("﻿Company,Website\nAcme,acme.com");
    expect(headers).toEqual(["Company", "Website"]);
  });

  it("suffixes a repeated header instead of rejecting the file", () => {
    // csv-parse refuses two identically named columns; suffixing keeps the
    // file importable and lets the mapping step show both.
    const { headers } = parseCsv("Email,Email,Email\na@x.com,b@x.com,c@x.com");
    expect(headers).toEqual(["Email", "Email (2)", "Email (3)"]);
  });

  it("names a blank header by its position", () => {
    const { headers } = parseCsv("Company,,Website\nAcme,x,acme.com");
    expect(headers).toEqual(["Company", "Column 2", "Website"]);
  });

  it("accepts a row with fewer columns than the header", () => {
    const { records } = parseCsv("Company,Website\nAcme");
    expect(records[0].Company).toBe("Acme");
  });

  it("skips blank lines", () => {
    const { records } = parseCsv("Company\nAcme\n\nGlobex\n");
    expect(records.map((r) => r.Company)).toEqual(["Acme", "Globex"]);
  });

  it("handles quoted values containing commas and newlines", () => {
    const { records } = parseCsv('Company,Signal\nAcme,"Hiring, urgently"');
    expect(records[0].Signal).toBe("Hiring, urgently");
  });

  it("throws CsvParseError on malformed input", () => {
    expect(() => parseCsv('Company\n"unclosed')).toThrow(CsvParseError);
  });
});

describe("suggestMapping", () => {
  it("maps headers by exact synonym, case-insensitively", () => {
    expect(suggestMapping(["COMPANY", "Website", "Email"])).toEqual({
      company: "COMPANY",
      website: "Website",
      contactEmail: "Email",
    });
  });

  it("recognizes alternative names for the company column", () => {
    expect(suggestMapping(["Project Name"]).company).toBe("Project Name");
    expect(suggestMapping(["Organisation"]).company).toBe("Organisation");
  });

  it("prefers the earlier synonym when a file has several candidates", () => {
    // "company" comes before "project" in the field's synonym list.
    expect(suggestMapping(["Project", "Company"]).company).toBe("Company");
  });

  it("keeps the first header when two differ only in case", () => {
    expect(suggestMapping(["Company", "company"]).company).toBe("Company");
  });

  it("does not assign the same header to two fields", () => {
    const mapping = suggestMapping(["Company", "Website", "Email"]);
    const assigned = Object.values(mapping);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it("returns an empty mapping when nothing matches", () => {
    expect(suggestMapping(["Foo", "Bar"])).toEqual({});
  });
});

describe("normalizeMapping", () => {
  const headers = ["Company", "Website"];

  it("keeps entries pointing at a header the file has", () => {
    expect(normalizeMapping({ company: "Company" }, headers)).toEqual({ company: "Company" });
  });

  it("drops entries pointing at a header the file does not have", () => {
    expect(normalizeMapping({ company: "Company", website: "Nope" }, headers)).toEqual({
      company: "Company",
    });
  });

  it("drops unknown field keys", () => {
    expect(normalizeMapping({ notAField: "Company" }, headers)).toEqual({});
  });

  it("drops non-string values", () => {
    expect(normalizeMapping({ company: 42, website: null }, headers)).toEqual({});
  });

  it.each([null, undefined, "a string", 7, ["Company"]])("returns an empty mapping for %j", (raw) => {
    expect(normalizeMapping(raw, headers)).toEqual({});
  });
});

describe("normalizeOptions", () => {
  it("falls back to the defaults for unknown values", () => {
    expect(normalizeOptions({ defaultVertical: "nope", defaultStatus: "nope" })).toEqual(
      DEFAULT_IMPORT_OPTIONS
    );
  });

  it("keeps valid values", () => {
    expect(
      normalizeOptions({
        defaultVertical: "card_affiliate",
        defaultStatus: "contacted",
        onDuplicateLead: "create",
        matchCompaniesByName: true,
      })
    ).toEqual({
      defaultVertical: "card_affiliate",
      defaultStatus: "contacted",
      onDuplicateLead: "create",
      matchCompaniesByName: true,
    });
  });

  it("only treats an exact true as opting into name matching", () => {
    expect(normalizeOptions({ matchCompaniesByName: "yes" }).matchCompaniesByName).toBe(false);
  });

  it.each([null, undefined, "x", 5])("returns the defaults for %j", (raw) => {
    expect(normalizeOptions(raw)).toEqual(DEFAULT_IMPORT_OPTIONS);
  });
});

describe("normalizeDomain (import)", () => {
  it.each([
    ["acme.com", "acme.com"],
    ["https://www.Acme.com/careers", "acme.com"],
    ["HTTPS://WWW.Acme.com/", "acme.com"],
    ["  Acme.COM  ", "acme.com"],
    ["sub.acme.com/x", "sub.acme.com"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });
});

describe("leadTitleFor", () => {
  it("joins the company and the signal", () => {
    expect(leadTitleFor("Acme", "Hiring a community lead")).toBe("Acme — Hiring a community lead");
  });

  it("uses a generic title when there is no signal", () => {
    expect(leadTitleFor("Acme", null)).toBe("Acme — imported lead");
  });

  it("collapses whitespace in the signal", () => {
    expect(leadTitleFor("Acme", "Hiring   a\n\tlead")).toBe("Acme — Hiring a lead");
  });

  it("truncates a long signal to 60 characters with an ellipsis", () => {
    const title = leadTitleFor("Acme", "x".repeat(200));
    const signalPart = title.replace("Acme — ", "");
    expect(signalPart).toHaveLength(60);
    expect(signalPart.endsWith("…")).toBe(true);
  });

  it("leaves a signal of exactly 60 characters intact", () => {
    expect(leadTitleFor("Acme", "y".repeat(60))).toBe(`Acme — ${"y".repeat(60)}`);
  });
});

describe("planImport", () => {
  it("plans a clean file as all creations", async () => {
    const result = await plan("Company,Website\nAcme,acme.com\nGlobex,globex.com");
    expect(result.summary).toEqual({
      rowsRead: 2,
      leadsToCreate: 2,
      companiesToCreate: 2,
      companiesToMatch: 0,
      contactsToCreate: 0,
      evidenceToCreate: 0,
      rowsToSkip: 0,
    });
    expect(result.rows.map((r) => r.companyAction)).toEqual(["create", "create"]);
  });

  it("numbers rows from 2, so they line up with a spreadsheet", async () => {
    const result = await plan("Company\nAcme\nGlobex");
    expect(result.rows.map((r) => r.rowNumber)).toEqual([2, 3]);
  });

  it("skips a row whose company cell is empty", async () => {
    const result = await plan("Company,Website\n,acme.com\nGlobex,globex.com");
    expect(result.rows[0].skipReason).toBe('The "Company" column is empty on this row.');
    expect(result.rows[0].companyAction).toBeNull();
    expect(result.summary).toMatchObject({ rowsRead: 2, rowsToSkip: 1, leadsToCreate: 1 });
  });

  it("skips every row when no column is mapped to Company", async () => {
    const result = await plan("Foo,Bar\nx,y", {}, {}, {});
    expect(result.rows[0].skipReason).toBe("No column is mapped to Company.");
    expect(result.summary.rowsToSkip).toBe(1);
  });

  it("reports headers it did not map", async () => {
    const result = await plan("Company,Website,Notes\nAcme,acme.com,hello");
    expect(result.unmappedHeaders).toEqual(["Notes"]);
  });

  it("matches an existing company by domain", async () => {
    const result = await plan("Company,Website\nAcme,https://www.acme.com/about", {
      companies: [{ id: "c1", name: "Acme", domain: "acme.com" }],
    });
    expect(result.rows[0]).toMatchObject({
      companyAction: "match",
      existingCompanyId: "c1",
      matchedCompanyName: "Acme",
      domain: "acme.com",
    });
    expect(result.summary).toMatchObject({ companiesToMatch: 1, companiesToCreate: 0 });
  });

  it("warns when matching will rename the existing company", async () => {
    const result = await plan("Company,Website\nAcme Labs,acme.com", {
      companies: [{ id: "c1", name: "Acme", domain: "acme.com" }],
    });
    expect(result.rows[0].warnings).toContain(
      'Matched the existing company "Acme" and will rename it to "Acme Labs".'
    );
  });

  it("warns that a row with no website cannot be deduped by domain", async () => {
    const result = await plan("Company\nAcme");
    expect(result.rows[0].warnings).toContain(
      "No website on this row, so it can't be deduped against companies already on file by domain."
    );
  });

  it("counts one company for several rows sharing a domain", async () => {
    const result = await plan(
      "Company,Website,Signal\nAcme,acme.com,Hiring a community lead\nAcme,acme.com,Launching a token"
    );
    expect(result.summary).toMatchObject({ leadsToCreate: 2, companiesToCreate: 1 });
    expect(result.rows.map((r) => r.companyKey)).toEqual(["domain:acme.com", "domain:acme.com"]);
  });

  it("counts one company for several rows sharing a name when there is no website", async () => {
    const result = await plan("Company,Signal\nAcme,First signal\nAcme,Second signal");
    expect(result.summary.companiesToCreate).toBe(1);
    expect(result.rows.map((r) => r.companyKey)).toEqual(["name:acme", "name:acme"]);
  });

  it("counts one match for several rows hitting the same existing company", async () => {
    const result = await plan(
      "Company,Website,Signal\nAcme,acme.com,First signal\nAcme,acme.com,Second signal",
      { companies: [{ id: "c1", name: "Acme", domain: "acme.com" }] }
    );
    expect(result.summary.companiesToMatch).toBe(1);
  });

  it("skips a later row that repeats an earlier row's lead", async () => {
    const result = await plan("Company,Website,Signal\nAcme,acme.com,Hiring\nAcme,acme.com,Hiring");
    expect(result.rows[1]).toMatchObject({
      duplicateOfRow: 2,
      skipReason: "Row 2 already covers this lead.",
    });
    expect(result.summary).toMatchObject({ leadsToCreate: 1, rowsToSkip: 1 });
  });

  it("keeps a repeated lead when asked to create rather than skip", async () => {
    const result = await plan(
      "Company,Website,Signal\nAcme,acme.com,Hiring\nAcme,acme.com,Hiring",
      {},
      { onDuplicateLead: "create" }
    );
    expect(result.rows[1].skipReason).toBeNull();
    expect(result.rows[1].duplicateOfRow).toBe(2);
    expect(result.rows[1].warnings).toContain(
      "Row 2 covers the same lead — this one gets a numbered title."
    );
    expect(result.summary.leadsToCreate).toBe(2);
  });

  it("treats two different signals at one company as two leads", async () => {
    const result = await plan(
      "Company,Website,Signal\nAcme,acme.com,Hiring a community lead\nAcme,acme.com,Launching a token"
    );
    expect(result.summary.leadsToCreate).toBe(2);
    expect(result.rows.every((r) => r.skipReason === null)).toBe(true);
  });

  it("skips a lead the matched company already has on file", async () => {
    const result = await plan(
      "Company,Website,Signal\nAcme,acme.com,Hiring",
      {
        companies: [{ id: "c1", name: "Acme", domain: "acme.com" }],
        leads: [{ company_id: "c1", title: "Acme — Hiring" }],
      }
    );
    expect(result.rows[0].skipReason).toBe("This lead is already on file for that company.");
    expect(result.summary).toMatchObject({ rowsToSkip: 1, leadsToCreate: 0 });
  });

  it("matches an existing lead title case-insensitively", async () => {
    const result = await plan("Company,Website,Signal\nAcme,acme.com,HIRING", {
      companies: [{ id: "c1", name: "Acme", domain: "acme.com" }],
      leads: [{ company_id: "c1", title: "Acme — hiring" }],
    });
    expect(result.rows[0].skipReason).toBe("This lead is already on file for that company.");
  });

  it("warns rather than skips an existing lead when asked to create", async () => {
    const result = await plan(
      "Company,Website,Signal\nAcme,acme.com,Hiring",
      {
        companies: [{ id: "c1", name: "Acme", domain: "acme.com" }],
        leads: [{ company_id: "c1", title: "Acme — Hiring" }],
      },
      { onDuplicateLead: "create" }
    );
    expect(result.rows[0].skipReason).toBeNull();
    expect(result.rows[0].warnings).toContain(
      "A lead with this title already exists for that company — this one gets a numbered title."
    );
  });

  it("ignores companies on file with the same name by default", async () => {
    // domain is the schema's dedupe key, and two unrelated companies can
    // share a name, so name matching is opt-in.
    const result = await plan("Company\nAcme", {
      companies: [{ id: "c1", name: "Acme", domain: null }],
    });
    expect(result.rows[0].companyAction).toBe("create");
    expect(result.rows[0].existingCompanyId).toBeNull();
  });

  it("matches on name when asked to", async () => {
    const result = await plan(
      "Company\nAcme",
      { companies: [{ id: "c1", name: "Acme", domain: null }] },
      { matchCompaniesByName: true }
    );
    expect(result.rows[0]).toMatchObject({ companyAction: "match", existingCompanyId: "c1" });
  });

  it("only matches a name whose capitalization matches what is stored", async () => {
    // Known limitation, asserted so it is visible: the lookup map is keyed
    // lower-cased, which reads as case-insensitive, but the query that fills
    // it compares names with `in` — and Postgres `in` is case-sensitive. So a
    // CSV saying "acme" does not find the stored company "Acme". Fixing it
    // properly needs a case-insensitive comparison in the query (or a
    // normalized name column), not a change here.
    const result = await plan(
      "Company\nacme",
      { companies: [{ id: "c1", name: "Acme", domain: null }] },
      { matchCompaniesByName: true }
    );
    expect(result.rows[0]).toMatchObject({ companyAction: "create", existingCompanyId: null });
  });

  it("prefers a domain match over a name match", async () => {
    const result = await plan(
      "Company,Website\nAcme,globex.com",
      {
        companies: [
          { id: "by-name", name: "Acme", domain: null },
          { id: "by-domain", name: "Globex", domain: "globex.com" },
        ],
      },
      { matchCompaniesByName: true }
    );
    expect(result.rows[0].existingCompanyId).toBe("by-domain");
  });

  it("applies the default vertical and status", async () => {
    const result = await plan("Company\nAcme", {}, {
      defaultVertical: "card_affiliate",
      defaultStatus: "researching",
    });
    expect(result.rows[0]).toMatchObject({ vertical: "card_affiliate", status: "researching" });
  });

  it("takes a recognized vertical, status and tier from the row", async () => {
    const result = await plan("Company,Vertical,Status,Tier\nAcme,HIRING,Contacted,a+");
    expect(result.rows[0]).toMatchObject({ vertical: "hiring", status: "contacted", tier: "A+" });
    expect(result.rows[0].warnings).toEqual([
      "No website on this row, so it can't be deduped against companies already on file by domain.",
    ]);
  });

  it("warns and falls back on an unrecognized vertical or status", async () => {
    const result = await plan("Company,Vertical,Status\nAcme,spaceships,pondering");
    expect(result.rows[0]).toMatchObject({ vertical: "general", status: "new" });
    expect(result.rows[0].warnings).toContain(
      'Vertical "spaceships" is not one this app knows — using "general".'
    );
    expect(result.rows[0].warnings).toContain(
      'Status "pondering" is not one this app knows — using "new".'
    );
  });

  it("leaves the tier blank when it is not recognized", async () => {
    const result = await plan("Company,Tier\nAcme,Platinum");
    expect(result.rows[0].tier).toBeNull();
    expect(result.rows[0].warnings).toContain(
      'Tier "Platinum" is not one this app knows — leaving it blank.'
    );
  });

  it("reads a numeric score", async () => {
    const result = await plan("Company,Score\nAcme,72");
    expect(result.rows[0].score).toBe(72);
  });

  it("clamps a score above 100", async () => {
    const result = await plan("Company,Score\nAcme,150");
    expect(result.rows[0].score).toBe(100);
    expect(result.rows[0].warnings).toContain("Score 150 is outside 0–100 — clamped to 100.");
  });

  it("clamps a negative score to 0", async () => {
    const result = await plan("Company,Score\nAcme,-20");
    expect(result.rows[0].score).toBe(0);
    expect(result.rows[0].warnings).toContain("Score -20 is outside 0–100 — clamped to 0.");
  });

  it("warns and uses 0 for a score that is not a number", async () => {
    const result = await plan("Company,Score\nAcme,high");
    expect(result.rows[0].score).toBe(0);
    expect(result.rows[0].warnings).toContain('Score "high" is not a number — using 0.');
  });

  it("plans a contact when any contact column has a value", async () => {
    const result = await plan("Company,Contact Name,Email\nAcme,Dana Lee,dana@acme.com");
    expect(result.rows[0].createsContact).toBe(true);
    expect(result.summary.contactsToCreate).toBe(1);
  });

  it("plans no contact when the contact columns are empty", async () => {
    const result = await plan("Company,Contact Name,Email\nAcme,,");
    expect(result.rows[0].createsContact).toBe(false);
    expect(result.summary.contactsToCreate).toBe(0);
  });

  it("plans evidence when an evidence URL is present", async () => {
    const result = await plan("Company,Evidence URL\nAcme,https://acme.com/careers");
    expect(result.rows[0].createsEvidence).toBe(true);
    expect(result.summary.evidenceToCreate).toBe(1);
  });

  it("keeps the untouched row on the plan so a wrong mapping loses nothing", async () => {
    const result = await plan("Company,Notes\nAcme,keep me");
    expect(result.rows[0].raw).toEqual({ Company: "Acme", Notes: "keep me" });
  });

  it("counts nothing for a file with only a header", async () => {
    const result = await plan("Company,Website");
    expect(result.rows).toEqual([]);
    expect(result.summary).toMatchObject({ rowsRead: 0, leadsToCreate: 0, rowsToSkip: 0 });
  });

  it("plans a skipped row so it writes nothing at all", async () => {
    const result = await plan("Company,Website,Signal\nAcme,acme.com,Hiring\nAcme,acme.com,Hiring");
    const skipped = result.rows[1];
    expect(skipped).toMatchObject({
      companyAction: null,
      createsContact: false,
      createsEvidence: false,
    });
  });
});
