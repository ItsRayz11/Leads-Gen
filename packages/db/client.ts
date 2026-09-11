import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

/**
 * Service-role client for server-side scripts (workers/GitHub Actions) that
 * need to bypass RLS. Never import this into browser or user-request code —
 * it has full read/write access to every table regardless of policy.
 */
/** Which of the two required vars are missing, or null when both are present. */
export function missingServiceRoleEnv(): string[] | null {
  const missing = [
    !process.env.SUPABASE_URL && "SUPABASE_URL",
    !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((v): v is string => typeof v === "string");
  return missing.length > 0 ? missing : null;
}

export function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = missingServiceRoleEnv();
  if (missing || !url || !key) {
    // Name only what's actually absent — reporting both when one is set
    // sends the reader looking for a problem that isn't there.
    throw new Error(
      `${(missing ?? []).join(" and ")} must be set on the server for this operation. Add ${
        (missing ?? []).length > 1 ? "them" : "it"
      } to the deployment's environment variables and redeploy.`
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type { Database } from "./types.js";
