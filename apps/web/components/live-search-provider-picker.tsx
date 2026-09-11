"use client";

import { useLiveSearchProviderStatus } from "../lib/hooks/use-live-search-provider-status";
import { LIVE_SEARCH_PROVIDERS, LIVE_SEARCH_PROVIDER_LABELS, type LiveSearchProvider } from "../lib/ai/search-filters";
import { Badge } from "./ui/badge";

/**
 * Lets a live_search filter pick which AI provider(s) actually run the web
 * search — one is cheapest/fastest, more than one finds more (differently
 * sourced) real companies at proportionally more cost and time. Shown only
 * when the vertical is live_search; every other vertical ignores this field.
 */
export function LiveSearchProviderPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { configured, loading } = useLiveSearchProviderStatus();

  function toggle(provider: LiveSearchProvider) {
    onChange(value.includes(provider) ? value.filter((p) => p !== provider) : [...value, provider]);
  }

  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
      <label className="text-xs font-medium">Which AI model(s) should run this search?</label>
      <div className="flex flex-wrap gap-2">
        {LIVE_SEARCH_PROVIDERS.map((provider) => {
          const isConfigured = configured[provider] ?? false;
          const checked = value.includes(provider);
          return (
            <label
              key={provider}
              className={`flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm ${
                isConfigured ? "cursor-pointer hover:bg-accent" : "cursor-not-allowed opacity-60"
              }`}
              title={isConfigured ? undefined : "No API key configured for this provider on the Integrations page"}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!isConfigured}
                onChange={() => toggle(provider)}
              />
              {LIVE_SEARCH_PROVIDER_LABELS[provider]}
              {!loading && !isConfigured && (
                <Badge variant="outline" className="text-[10px]">
                  no key
                </Badge>
              )}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Each extra model is a separate paid search — selecting more than one finds more (differently sourced) real
        companies, at proportionally more cost and time. Leave unset to use Google (Gemini) alone.
      </p>
    </div>
  );
}
