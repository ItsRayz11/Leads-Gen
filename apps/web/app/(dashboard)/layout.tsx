import { Sidebar } from "../../components/sidebar";
import { createClient } from "../../lib/supabase/server";
import { signOut } from "../login/actions";
import { Button } from "../../components/ui/button";
import { NotificationBell } from "../../components/notification-bell";
import { CommandPalette } from "../../components/command-palette";
import { CommandPaletteTrigger } from "../../components/command-palette-trigger";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex">
      <Sidebar />
      <CommandPalette />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <CommandPaletteTrigger />
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-xs text-muted-foreground">{user?.email}</span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
