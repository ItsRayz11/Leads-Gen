import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

/**
 * Service-role client for server-side scripts (workers/GitHub Actions) that
 * need to bypass RLS. Never import this into browser or user-request code —
 * it has full read/write access to every table regardless of policy.
 */
export function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type { Database } from "./types.js";
