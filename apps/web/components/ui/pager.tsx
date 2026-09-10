"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Button } from "./button";
import { Select } from "./input";
import { PAGE_SIZES } from "../../lib/paging";

export interface PagerProps {
  /** Route to push to, e.g. "/companies". */
  basePath: string;
  /** The page's current query string, so paging preserves the active filters. */
  searchParams: string;
  page: number;
  perPage: number;
  /** Total matching rows in the database, not just the ones on this page. */
  total: number;
  /** Rows actually rendered, so the last page reports its real range. */
  rowsOnPage: number;
  /** What the rows are called, for the count line. */
  noun: { one: string; many: string };
}

/**
 * The row count, page-size picker and prev/next controls for a list page.
 * Extracted from the /leads table so the other lists page the same way
 * instead of each capping its query at a few hundred rows.
 */
export function Pager({
  basePath,
  searchParams,
  page,
  perPage,
  total,
  rowsOnPage,
  noun,
}: PagerProps) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();

  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams);
      mutate(params);
      const query = params.toString();
      startNavigation(() => router.push(query ? `${basePath}?${query}` : basePath));
    },
    [basePath, router, searchParams]
  );

  const firstRow = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastRow = (page - 1) * perPage + rowsOnPage;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        {total === 0
          ? `No ${noun.many}`
          : `Showing ${firstRow}–${lastRow} of ${total} ${total === 1 ? noun.one : noun.many}`}
      </span>

      <div className="flex items-center gap-2">
        {navigating && <span>Loading…</span>}

        <Select
          className="h-8 text-xs"
          aria-label="Rows per page"
          value={String(perPage)}
          onChange={(event) =>
            navigate((params) => {
              params.set("perPage", event.target.value);
              // A different page size makes the current page number meaningless.
              params.delete("page");
            })
          }
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </Select>

        <span>
          Page {page} of {lastPage}
        </span>

        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1 || navigating}
          onClick={() => navigate((params) => params.set("page", String(page - 1)))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= lastPage || navigating}
          onClick={() => navigate((params) => params.set("page", String(page + 1)))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
