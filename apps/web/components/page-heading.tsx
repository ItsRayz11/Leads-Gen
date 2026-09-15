"use client";

import { usePathname } from "next/navigation";
import { NAV } from "./sidebar";

export function PageHeading() {
  const pathname = usePathname();

  let label = "Dashboard";
  let section: string | null = null;
  for (const group of NAV) {
    const match = group.items.find(
      (item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
    );
    if (match) {
      label = match.label;
      section = group.section;
      break;
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm">
      {section && section !== "Overview" && (
        <>
          <span className="hidden text-muted-foreground sm:inline">{section}</span>
          <span className="hidden text-muted-foreground/40 sm:inline">/</span>
        </>
      )}
      <span className="truncate font-medium">{label}</span>
    </div>
  );
}
