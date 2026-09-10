/**
 * Pure redirect decision for the auth middleware, kept separate from
 * `updateSession`'s Supabase/cookie plumbing so it's unit-testable without
 * mocking a NextRequest or a Supabase client.
 */
export function resolveAuthRedirect(pathname: string, hasUser: boolean): "/login" | "/" | null {
  const isAuthRoute = pathname.startsWith("/login");
  if (!hasUser && !isAuthRoute) return "/login";
  if (hasUser && isAuthRoute) return "/";
  return null;
}
