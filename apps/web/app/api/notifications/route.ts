import { NextResponse } from "next/server";
import { requireUser } from "../../../lib/api-auth";
import { countUnreadNotifications, listNotifications } from "../../../lib/data/notifications";

/** Powers the header bell: unread count plus a short recent list. */
export async function GET() {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const [unreadCount, { rows: recent }] = await Promise.all([
    countUnreadNotifications(),
    listNotifications({}, { page: 1, perPage: 8 }),
  ]);
  return NextResponse.json({ unreadCount, recent });
}
