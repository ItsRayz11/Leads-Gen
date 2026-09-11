import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createServiceRoleClient } from "./client.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function loadEncryptionKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is not set. Generate one (e.g. `openssl rand -base64 32`) and add it as a server env var to store provider API keys in the database."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SECRETS_ENCRYPTION_KEY must decode to exactly 32 bytes (a base64-encoded 256-bit key).");
  }
  return key;
}

/** IV + authTag + ciphertext, packed into one base64 string. */
export function encryptSecret(plaintext: string): string {
  const key = loadEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(packed: string): string {
  const key = loadEncryptionKey();
  const buf = Buffer.from(packed, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buf.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * The value to actually use for a provider — null if no row exists (or the
 * lookup itself can't run). Callers that also check an env var should check
 * the env var first and only fall back to this (env vars are the faster,
 * simpler path; this is for keys the user entered through the Integrations
 * page instead).
 *
 * This is an optional convenience on top of env vars, not a hard
 * requirement — apps/web didn't need SUPABASE_SERVICE_ROLE_KEY or
 * SECRETS_ENCRYPTION_KEY before this feature existed, so a deployment that
 * hasn't set them yet should keep working on env-var keys alone rather than
 * 500ing every page that happens to check for a database-stored key.
 */
export async function getProviderSecret(providerName: string): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("provider_secrets")
      .select("ciphertext")
      .eq("provider_name", providerName)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return decryptSecret(data.ciphertext);
  } catch (err) {
    console.warn(`[provider-secrets] could not look up "${providerName}": ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export async function setProviderSecret(
  providerName: string,
  category: "lead_data" | "ai",
  plaintext: string
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("provider_secrets")
    .upsert(
      { provider_name: providerName, category, ciphertext: encryptSecret(plaintext), updated_at: new Date().toISOString() },
      { onConflict: "provider_name" }
    );
  if (error) throw error;
}

export async function deleteProviderSecret(providerName: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("provider_secrets").delete().eq("provider_name", providerName);
  if (error) throw error;
}

/**
 * Whether the database-backed key store can be read at all, and if not, why.
 *
 * Reading it needs two server-only env vars — SUPABASE_SERVICE_ROLE_KEY (the
 * rows are service-role only) and SECRETS_ENCRYPTION_KEY (to decrypt). When
 * either is missing, every stored key silently becomes invisible: the
 * Integrations page shows providers as unconfigured and AI features report
 * "no API key configured" even though the user entered one and saw it saved.
 * That's the single most confusing failure this app can have, so the reason
 * travels with the result instead of going only to a server log.
 */
export interface SecretStoreStatus {
  /** Provider names with a row in the table. Empty when `unavailable` is set. */
  providers: Set<string>;
  /** Null when the store was read successfully; otherwise why it couldn't be. */
  unavailable: string | null;
}

/** Which required env vars are missing, as a user-facing phrase, or null when all are present. */
export function missingSecretStoreEnv(): string | null {
  const missing = [
    !process.env.SUPABASE_URL && "SUPABASE_URL",
    !process.env.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    !process.env.SECRETS_ENCRYPTION_KEY && "SECRETS_ENCRYPTION_KEY",
  ].filter((v): v is string => typeof v === "string");
  return missing.length > 0 ? missing.join(", ") : null;
}

/** Provider names with a row in the table — no decryption, just presence, for status badges. Fails open (empty set) rather than breaking the Integrations page, but reports why. */
export async function getSecretStore(): Promise<SecretStoreStatus> {
  const missingEnv = missingSecretStoreEnv();
  if (missingEnv) {
    return {
      providers: new Set(),
      unavailable: `Keys saved on this page can't be read back because ${missingEnv} ${
        missingEnv.includes(",") ? "are" : "is"
      } not set on the server. Add ${missingEnv.includes(",") ? "them" : "it"} to the deployment's environment variables and redeploy.`,
    };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("provider_secrets").select("provider_name");
    if (error) throw error;
    return { providers: new Set((data ?? []).map((row) => row.provider_name)), unavailable: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[provider-secrets] could not list configured providers: ${message}`);
    return { providers: new Set(), unavailable: `The stored-key lookup failed: ${message}` };
  }
}

/** Back-compat shorthand for callers that only need the names. */
export async function listSecretProviders(): Promise<Set<string>> {
  return (await getSecretStore()).providers;
}
