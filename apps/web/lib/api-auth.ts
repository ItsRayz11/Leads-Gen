import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";

/**
 * The explicit auth gate for route handlers.
 *
 * Two other layers already stand in front of these routes: the middleware
 * redirects an unauthenticated request to /login, and RLS denies anonymous
 * reads and writes at the database. Neither is a substitute for the check
 * being visible in the handler itself:
 *
 * - The middleware's protection is a URL matcher. Narrowing that matcher —
 *   a perfectly ordinary change — would quietly expose every route here.
 * - RLS answers an anonymous read with *zero rows*, not an error, so the
 *   routes degrade into returning an empty CSV or a 404 rather than a 401.
 *   That's safe but it isn't truthful, and it makes the gate look like a bug.
 * - Routes that call a paid AI provider decide whether to spend money before
 *   RLS is consulted at all in some paths; a 401 should come first.
 *
 * Returns `null` when the caller is authenticated, or the 401 response the
 * handler should return as-is.
 */
export async function requireUser(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
