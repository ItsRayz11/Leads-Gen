"use client";

import { useEffect, useState } from "react";
import type { LiveSearchProvider } from "../ai/search-filters";
import { fetchJsonSafe } from "./fetch-json";

export interface LiveSearchProviderStatusState {
  /** Undefined until the fetch resolves — treat as "unknown yet", not "not configured". */
  configured: Partial<Record<LiveSearchProvider, boolean>>;
  loading: boolean;
}

/** Which live-search providers actually have a usable key right now, for the picker in the filter editor. */
export function useLiveSearchProviderStatus(): LiveSearchProviderStatusState {
  const [state, setState] = useState<LiveSearchProviderStatusState>({ configured: {}, loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchJsonSafe<{ configured?: Partial<Record<LiveSearchProvider, boolean>> }>(
        "/api/live-search-providers",
        "live-search provider status"
      );
      if (cancelled) return;
      setState({ configured: result.ok ? (result.data.configured ?? {}) : {}, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
