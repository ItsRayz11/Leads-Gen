"use client";

import { useEffect, useState } from "react";
import {
  COMPANY_SIZES,
  COUNTRIES,
  EXCLUDE_SUGGESTIONS,
  INDUSTRIES,
  REGIONS,
  ROLE_SUGGESTIONS,
  SERVICE_TYPE_SUGGESTIONS,
} from "../ai/search-filters";

export interface FilterOptionsState {
  industries: readonly string[];
  countries: readonly string[];
  regions: readonly string[];
  companySizes: readonly string[];
  serviceTypes: readonly string[];
  roleKeywords: readonly string[];
  excludeKeywords: readonly string[];
  loading: boolean;
  error: string | null;
}

const STATIC_DEFAULTS: Omit<FilterOptionsState, "loading" | "error"> = {
  industries: INDUSTRIES,
  countries: COUNTRIES,
  regions: REGIONS,
  companySizes: COMPANY_SIZES,
  serviceTypes: SERVICE_TYPE_SUGGESTIONS,
  roleKeywords: ROLE_SUGGESTIONS,
  excludeKeywords: EXCLUDE_SUGGESTIONS,
};

/**
 * Every filter dropdown needs *some* options to render immediately (the
 * curated seed lists in search-filters.ts), then upgrades to the merged
 * seed + real-database-values list once /api/filter-options responds. A
 * failed fetch just keeps the curated defaults — the field stays usable,
 * it just won't reflect brand-new values from the live data yet.
 */
export function useFilterOptions(): FilterOptionsState {
  const [state, setState] = useState<FilterOptionsState>({ ...STATIC_DEFAULTS, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/filter-options");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState((prev) => ({ ...prev, loading: false, error: data.error ?? "Could not load filter options." }));
          return;
        }
        setState({ ...data.options, loading: false, error: null });
      } catch {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false, error: "Could not reach the filter options endpoint." }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
