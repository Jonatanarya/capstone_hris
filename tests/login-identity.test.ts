import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  lookup: vi.fn(),
  eq: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mock.admin,
}));
import { resolveLoginEmail } from "../lib/api/login-identity";
beforeEach(() => {
  vi.clearAllMocks();
  mock.admin.mockReturnValue({
    from: () => ({ select: () => ({ eq: mock.eq }) }),
  });
  mock.eq.mockReturnValue({ maybeSingle: mock.lookup });
  mock.lookup.mockResolvedValue({
    data: { work_email: "private@example.test" },
    error: null,
  });
});
describe("server-only NIM/employee-number login mapping", () => {
  it("looks up an exact identifier, without exposing email or trusting a role", async () => {
    expect(await resolveLoginEmail(" 2300000001 ")).toBe(
      "private@example.test",
    );
    expect(mock.eq).toHaveBeenCalledWith("employee_no", "2300000001");
  });
  it("supports old employee numbers and legacy email without an elevated lookup", async () => {
    expect(await resolveLoginEmail("EMP-001")).toBe("private@example.test");
    expect(await resolveLoginEmail(" USER@EXAMPLE.TEST ")).toBe(
      "user@example.test",
    );
    expect(mock.admin).toHaveBeenCalledTimes(1);
  });
  it("unknown identifier returns the same invalid-credentials error as a wrong password", async () => {
    mock.lookup.mockResolvedValue({ data: null, error: null });
    await expect(resolveLoginEmail("2300000099")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
  });
  it.each(["", "a'.or(1=1)", "a,b", "a/b", "a".repeat(31)])(
    "rejects malformed identifiers before lookup: %s",
    async (identifier) => {
      await expect(resolveLoginEmail(identifier)).rejects.toMatchObject({
        status: 401,
      });
      expect(mock.admin).not.toHaveBeenCalled();
    },
  );
  it("does not turn a database outage into a valid identity", async () => {
    mock.lookup.mockResolvedValue({
      data: null,
      error: { message: "unavailable" },
    });
    await expect(resolveLoginEmail("2300000001")).rejects.toMatchObject({
      status: 503,
    });
  });
});
