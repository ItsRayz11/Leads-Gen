import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/api-auth";
import { removeTargetCompany, setTargetCompanyEnabled } from "@leads/db/target-companies.js";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  try {
    await removeTargetCompany(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to remove company." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const input = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof input.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
  }

  try {
    await setTargetCompanyEnabled(id, input.enabled);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update company." }, { status: 500 });
  }
}
