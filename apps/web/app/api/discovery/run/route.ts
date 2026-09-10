import { NextRequest, NextResponse } from "next/server";
import { runVertical1Hiring, runVertical2General, runVertical3CardAffiliate } from "@leads/workers";
import { createClient } from "../../../../lib/supabase/server";

// Connectors make several sequential external HTTP calls; give this route
// room to run on platforms (e.g. Vercel Pro+) that honor maxDuration.
export const maxDuration = 300;

const RUNNERS = {
  vertical1: runVertical1Hiring,
  vertical2: runVertical2General,
  vertical3: runVertical3CardAffiliate,
} as const;

type Vertical = keyof typeof RUNNERS;

function isVertical(value: unknown): value is Vertical {
  return typeof value === "string" && value in RUNNERS;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const vertical = body?.vertical;
  if (!isVertical(vertical)) {
    return NextResponse.json({ error: "vertical must be one of vertical1, vertical2, vertical3" }, { status: 400 });
  }

  try {
    const result = await RUNNERS[vertical]();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Discovery run failed." },
      { status: 500 }
    );
  }
}
