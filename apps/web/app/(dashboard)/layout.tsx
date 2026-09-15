import { Sidebar } from "../../components/sidebar";
import { createClient } from "../../lib/supabase/server";
import { signOut } from "../login/actions";
import { Button } from "../../components/ui/button";
import { NotificationBell } from "../../components/notification-bell";
import { CommandPalette } from "../../components/command-palette";
import { CommandPaletteTrigger } from "../../components/command-palette-trigger";
import { PageHeading } from "../../components/page-heading";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex items-start">
      <Sidebar />
      <CommandPalette />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <PageHeading />
          <div className="flex items-center gap-3">
            <CommandPaletteTrigger />
            <NotificationBell />
            <span className="hidden text-xs text-muted-foreground md:inline">{user?.email}</span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
