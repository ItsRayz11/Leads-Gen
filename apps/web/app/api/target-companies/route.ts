import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { addTargetCompany, listTargetCompanies, type TargetCompanySource } from "@leads/db/target-companies.js";

const SOURCES: TargetCompanySource[] = ["greenhouse", "lever", "ashby", "agency"];

function isSource(value: unknown): value is TargetCompanySource {
  return typeof value === "string" && (SOURCES as string[]).includes(value);
}

/** All configured companies, grouped by source, for the Integrations page. */
export async function GET() {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const bySource = Object.fromEntries(
    await Promise.all(SOURCES.map(async (source) => [source, await listTargetCompanies(source)] as const))
  );
  return NextResponse.json({ bySource });
}

interface TargetCompanyInput {
  source: string;
  identifier: string;
  label?: string;
  twitterHandle?: string;
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const input = (await req.json().catch(() => ({}))) as Partial<TargetCompanyInput>;
  if (!isSource(input.source)) {
    return NextResponse.json({ error: `source must be one of ${SOURCES.join(", ")}.` }, { status: 400 });
  }
  if (!input.identifier?.trim()) {
    return NextResponse.json({ error: "identifier is required." }, { status: 400 });
  }

  try {
    const row = await addTargetCompany({
      source: input.source,
      identifier: input.identifier.trim(),
      label: input.label,
      extra: input.twitterHandle?.trim() ? { twitterHandle: input.twitterHandle.trim() } : null,
    });
    return NextResponse.json({ row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add company." }, { status: 500 });
  }
}
