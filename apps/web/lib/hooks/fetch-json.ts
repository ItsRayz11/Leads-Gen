/**
 * The fetch-json-with-error-handling boilerplate every "load this once on
 * mount" hook needs (use-filter-options.ts, use-live-search-provider-status.ts):
 * a thrown network error and a non-2xx JSON response both become one
 * uniform result, so a hook's effect just awaits this and maps the result
 * into its own state shape instead of repeating the try/catch itself.
 *
 * `label` names what's being loaded for the fallback error message (e.g.
 * "filter options") — the raw `url` never appears in user-facing text.
 */
export async function fetchJsonSafe<T = unknown>(
  url: string,
  label: string
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error ?? `Could not load ${label}.` };
    return { ok: true, data };
  } catch {
    return { ok: false, error: `Could not reach the server to load ${label}.` };
  }
}
