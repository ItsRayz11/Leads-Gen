import { describe, expect, it } from "vitest";
import { resolveAuthRedirect } from "../apps/web/lib/supabase/auth-redirect";

describe("resolveAuthRedirect", () => {
  it("sends a signed-out visitor to /login", () => {
    expect(resolveAuthRedirect("/", false)).toBe("/login");
    expect(resolveAuthRedirect("/leads", false)).toBe("/login");
    expect(resolveAuthRedirect("/leads/123", false)).toBe("/login");
  });

  it("lets a signed-out visitor stay on /login", () => {
    expect(resolveAuthRedirect("/login", false)).toBeNull();
  });

  it("sends a signed-in user away from /login", () => {
    expect(resolveAuthRedirect("/login", true)).toBe("/");
  });

  it("lets a signed-in user stay on any other route", () => {
    expect(resolveAuthRedirect("/", true)).toBeNull();
    expect(resolveAuthRedirect("/leads", true)).toBeNull();
    expect(resolveAuthRedirect("/settings", true)).toBeNull();
  });

  it("treats any path under /login as the auth route, not just the exact path", () => {
    expect(resolveAuthRedirect("/login/reset-password", false)).toBeNull();
    expect(resolveAuthRedirect("/login/reset-password", true)).toBe("/");
  });
});
