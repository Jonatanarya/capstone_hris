import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  resolve: vi.fn(),
  signin: vi.fn(),
  signout: vi.fn(),
  actor: vi.fn(),
  active: vi.fn(),
  me: vi.fn(),
}));
vi.mock("@/lib/api/login-identity", () => ({
  resolveLoginEmail: mock.resolve,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: mock.signin, signOut: mock.signout },
  }),
}));
vi.mock("@/lib/api/actor", () => ({
  getActor: mock.actor,
  assertActive: mock.active,
}));
vi.mock("@/lib/api/me", () => ({ buildMe: mock.me }));
import { POST } from "../app/api/v1/auth/login/route";
import { api } from "../lib/api/http";
const req = (body: unknown) =>
  new Request("https://hris.test/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.resolve.mockResolvedValue("server-alias@example.test");
  mock.signin.mockResolvedValue({ error: null });
  mock.actor.mockResolvedValue({ role: "EMPLOYEE" });
  mock.active.mockImplementation(() => undefined);
  mock.me.mockResolvedValue({ role: "EMPLOYEE", userId: "user-1" });
  mock.signout.mockResolvedValue({ error: null });
});
describe("NIM login route", () => {
  it("authenticates the mapped identity and returns server-controlled role", async () => {
    const response = await POST(
      req({ identifier: "2300000001", password: "test-only-password" }),
    );
    expect(response.status).toBe(200);
    expect(mock.resolve).toHaveBeenCalledWith("2300000001");
    expect(mock.signin).toHaveBeenCalledWith({
      email: "server-alias@example.test",
      password: "test-only-password",
    });
    expect(
      ((await response.json()) as { data: { role: string } }).data.role,
    ).toBe("EMPLOYEE");
  });
  it("retains legacy email request compatibility", async () => {
    expect(
      (
        await POST(
          req({ email: "user@example.test", password: "test-only-password" }),
        )
      ).status,
    ).toBe(200);
    expect(mock.resolve).toHaveBeenCalledWith("user@example.test");
  });
  it.each([
    {
      identifier: "2300000001",
      password: "test-only-password",
      role: "ADMIN_HR",
    },
    {
      identifier: "2300000001",
      email: "user@example.test",
      password: "test-only-password",
    },
    { identifier: 2300000001, password: "test-only-password" },
    { identifier: "2300000001", password: "x".repeat(129) },
    { identifier: "2300000001", password: "test-only-password", unknown: true },
  ])(
    "rejects malformed/tampered payload before authentication %#",
    async (body) => {
      expect((await POST(req(body))).status).toBe(422);
      expect(mock.signin).not.toHaveBeenCalled();
    },
  );
  it("wrong password never returns a profile", async () => {
    mock.signin.mockResolvedValue({ error: { message: "bad credentials" } });
    expect(
      (await POST(req({ identifier: "2300000001", password: "incorrect" })))
        .status,
    ).toBe(401);
    expect(mock.me).not.toHaveBeenCalled();
  });
  it("disabled/inactive account cannot keep a newly issued session", async () => {
    mock.active.mockImplementation(() => {
      throw api.forbidden();
    });
    expect(
      (
        await POST(
          req({ identifier: "2300000001", password: "test-only-password" }),
        )
      ).status,
    ).toBe(403);
    expect(mock.signout).toHaveBeenCalledWith({ scope: "local" });
    expect(mock.me).not.toHaveBeenCalled();
  });
});
