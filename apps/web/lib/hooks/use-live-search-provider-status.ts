"use client";

import { useEffect, useState } from "react";
import type { LiveSearchProvider } from "../ai/search-filters";

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
      try {
        const res = await fetch("/api/live-search-providers");
        const data = await res.json();
        if (cancelled) return;
        setState({ configured: res.ok ? (data.configured ?? {}) : {}, loading: false });
      } catch {
        if (cancelled) return;
        setState({ configured: {}, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
