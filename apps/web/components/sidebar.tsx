"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Rows3,
  KanbanSquare,
  Building2,
  Users,
  Radio,
  FileSearch,
  CalendarClock,
  Send,
  ListChecks,
  StickyNote,
  BookmarkCheck,
  BarChart3,
  Upload,
  Download,
  Plug,
  Settings,
} from "lucide-react";
import { cn } from "../lib/utils";

const NAV = [
  { section: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    section: "Pipeline",
    items: [
      { href: "/discovery", label: "Lead Discovery", icon: Search },
      { href: "/leads", label: "All Leads", icon: Rows3 },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
    ],
  },
  {
    section: "Records",
    items: [
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/signals", label: "Signals", icon: Radio },
      { href: "/evidence", label: "Evidence", icon: FileSearch },
    ],
  },
  {
    section: "Work",
    items: [
      { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
      { href: "/outreach", label: "Outreach", icon: Send },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
      { href: "/notes", label: "Notes", icon: StickyNote },
    ],
  },
  {
    section: "Insights",
    items: [
      { href: "/saved-searches", label: "Saved Searches", icon: BookmarkCheck },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    section: "Data",
    items: [
      { href: "/import", label: "Import", icon: Upload },
      { href: "/export", label: "Export", icon: Download },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/integrations", label: "Integrations", icon: Plug },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
      <div className="px-4 py-4">
        <p className="text-sm font-semibold leading-tight">Lead Intelligence</p>
        <p className="text-xs text-muted-foreground">Workspace</p>
      </div>
      <nav className="flex-1 space-y-4 px-2 pb-4">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
