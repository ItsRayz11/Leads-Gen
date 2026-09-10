import Link from "next/link";
import { listNotifications } from "../../../lib/data/notifications";
import { NotificationTypeBadge } from "../../../components/ui/badge";
import { formatDateTime } from "../../../lib/utils";
import { Pager } from "../../../components/ui/pager";
import { queryString, resolvePage, resolvePerPage, single, type SearchParams } from "../../../lib/paging";
import { NotificationRowActions } from "../../../components/notification-row-actions";
import { MarkAllNotificationsRead } from "../../../components/mark-all-notifications-read";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const unreadOnly = single(params, "unread") === "1";
  const page = resolvePage(single(params, "page"));
  const perPage = resolvePerPage(single(params, "perPage"));

  const { rows: notifications, total } = await listNotifications({ unreadOnly }, { page, perPage });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {total} notification{total === 1 ? "" : "s"}
            {unreadOnly ? " (unread only)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={unreadOnly ? "/notifications" : "/notifications?unread=1"}
            className="text-xs text-primary hover:underline"
          >
            {unreadOnly ? "Show all" : "Show unread only"}
          </Link>
          <MarkAllNotificationsRead />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Notification</th>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {notifications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  {unreadOnly ? "No unread notifications." : "No notifications yet."}
                </td>
              </tr>
            ) : (
              notifications.map((n) => (
                <tr
                  key={n.id}
                  className={`border-b border-border last:border-0 hover:bg-accent/40 ${
                    n.read ? "" : "bg-accent/20"
                  }`}
                >
                  <td className="px-3 py-2">
                    <NotificationTypeBadge type={n.type} />
                  </td>
                  <td className="max-w-md px-3 py-2">
                    <p className="font-medium text-foreground">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  </td>
                  <td className="px-3 py-2">
                    {n.related_lead_id ? (
                      <Link href={`/leads/${n.related_lead_id}`} className="text-primary hover:underline">
                        {n.lead?.company?.name ?? "View lead"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDateTime(n.created_at)}</td>
                  <td className="px-3 py-2">
                    <NotificationRowActions id={n.id} read={n.read} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager
        basePath="/notifications"
        searchParams={queryString(params)}
        page={page}
        perPage={perPage}
        total={total}
        rowsOnPage={notifications.length}
        noun={{ one: "notification", many: "notifications" }}
      />
    </div>
  );
}
