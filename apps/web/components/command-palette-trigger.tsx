"use client";

import { Search } from "lucide-react";
import { openCommandPalette } from "./command-palette";

export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Search className="h-3.5 w-3.5" />
      Search…
      <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">Ctrl K</kbd>
    </button>
  );
}
