import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  claims: vi.fn(),
  user: vi.fn(),
  profile: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  cookie: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getClaims: mock.claims,
      getUser: mock.user,
      refreshSession: mock.refresh,
      signOut: mock.logout,
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ select: () => ({ eq: mock.eq }) }),
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mock.cookie }),
}));
import { POST } from "../app/api/v1/auth/confirm/route";
const req = (
  body: unknown = { access_token: "test-jwt", refresh_token: "test-refresh" },
) =>
  new Request("https://hris.test/api/v1/auth/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_FLOW_SECRET", "test-private-key");
  mock.claims.mockResolvedValue({
    data: {
      claims: {
        sub: "user-1",
        amr: [{ method: "otp", timestamp: Date.now() / 1000 }],
      },
    },
    error: null,
  });
  mock.user.mockResolvedValue({
    data: {
      user: {
        id: "user-1",
        invited_at: "2026-10-07",
        email_confirmed_at: "2026-10-07",
      },
    },
    error: null,
  });
  mock.profile.mockResolvedValue({
    data: { account_status: "INVITED" },
    error: null,
  });
  mock.eq.mockReturnValue({ maybeSingle: mock.profile });
  mock.refresh.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  mock.logout.mockResolvedValue({ error: null });
});
describe("default email invite bridge — no email/password writes", () => {
  it("verifies Auth proof, limits profile lookup to verified user, validates refresh and issues HttpOnly flow", async () => {
    expect((await POST(req())).status).toBe(200);
    expect(mock.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mock.refresh).toHaveBeenCalledWith({
      refresh_token: "test-refresh",
    });
    expect(mock.cookie).toHaveBeenCalledWith(
      "hris-auth-flow",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, maxAge: 900 }),
    );
  });
  it("rejects invalid signatures before privileged reads or session writes", async () => {
    mock.claims.mockResolvedValue({
      data: null,
      error: { message: "invalid" },
    });
    expect((await POST(req())).status).toBe(401);
    expect(mock.eq).not.toHaveBeenCalled();
    expect(mock.refresh).not.toHaveBeenCalled();
  });
  it("rejects ordinary login proof before session writes", async () => {
    mock.claims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-1",
          amr: [{ method: "password", timestamp: Date.now() / 1000 }],
        },
      },
      error: null,
    });
    expect((await POST(req())).status).toBe(403);
    expect(mock.refresh).not.toHaveBeenCalled();
    expect(mock.cookie).not.toHaveBeenCalled();
  });
  it("rejects mismatched refresh identity, signs out, never grants flow", async () => {
    mock.refresh.mockResolvedValue({
      data: { user: { id: "other" } },
      error: null,
    });
    expect((await POST(req())).status).toBe(401);
    expect(mock.logout).toHaveBeenCalledWith({ scope: "local" });
    expect(mock.cookie).not.toHaveBeenCalled();
  });
  it("rejects unknown or missing token fields before Auth", async () => {
    expect(
      (
        await POST(
          req({
            access_token: "test-jwt",
            refresh_token: "test-refresh",
            type: "invite",
          }),
        )
      ).status,
    ).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
    expect(mock.claims).not.toHaveBeenCalled();
  });
});
