import { NextResponse } from "next/server";
import { countUnreadNotifications, listNotifications } from "../../../lib/data/notifications";

/** Powers the header bell: unread count plus a short recent list. */
export async function GET() {
  const [unreadCount, { rows: recent }] = await Promise.all([
    countUnreadNotifications(),
    listNotifications({}, { page: 1, perPage: 8 }),
  ]);
  return NextResponse.json({ unreadCount, recent });
}
