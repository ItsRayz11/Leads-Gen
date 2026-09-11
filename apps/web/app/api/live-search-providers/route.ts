import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { isProviderConfigured } from "../../../lib/ai/client";
import { LIVE_SEARCH_PROVIDERS } from "../../../lib/ai/search-filters";

/**
 * Backs the live-search provider picker in the filter editor: which of
 * google/openai/anthropic actually have a usable key right now (env var or
 * the Integrations page), so the UI can gray out a provider instead of
 * letting someone select one that will just silently find nothing.
 */
export async function GET() {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const entries = await Promise.all(
    LIVE_SEARCH_PROVIDERS.map(async (provider) => [provider, await isProviderConfigured(provider)] as const)
  );
  return NextResponse.json({ configured: Object.fromEntries(entries) });
}
