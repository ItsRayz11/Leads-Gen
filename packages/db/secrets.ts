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

/** Provider names with a row in the table — no decryption, just presence, for status badges. Fails open (empty set) rather than breaking the Integrations page when service-role access isn't configured. */
export async function listSecretProviders(): Promise<Set<string>> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("provider_secrets").select("provider_name");
    if (error) throw error;
    return new Set((data ?? []).map((row) => row.provider_name));
  } catch (err) {
    console.warn(`[provider-secrets] could not list configured providers: ${err instanceof Error ? err.message : err}`);
    return new Set();
  }
}
