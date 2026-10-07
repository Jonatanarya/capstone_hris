import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), actor: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: mock.rpc }),
}));
vi.mock("@/lib/api/actor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api/actor")>()),
  getActor: mock.actor,
}));
import { GET } from "../app/api/v1/payroll-runs/[id]/readiness/route";
import { POST } from "../app/api/v1/payroll-runs/[id]/sync/route";
const id = "a0000000-0000-4000-8000-000000000001";
const ctx = { params: Promise.resolve({ id }) };
const req = (body: unknown = { expectedVersion: 1 }) =>
  new Request("https://hris.test/api/v1/payroll-runs/" + id + "/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.actor.mockResolvedValue({
    role: "ADMIN_HR",
    accountStatus: "ACTIVE",
    employeeStatus: "ACTIVE",
  });
  mock.rpc.mockResolvedValue({
    data: {
      id,
      period: "2026-10",
      status: "DRAFT",
      version: 2,
      ready: false,
      missingSalaryCount: 40,
    },
    error: null,
  });
});
describe("payroll readiness/sync routes", () => {
  it("reports missing salaries to HR without mutating the run", async () => {
    const response = await GET(new Request("https://hris.test"), ctx);
    expect(response.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("payroll_run_readiness", {
      p_run_id: id,
    });
  });
  it("synchronizes only with an explicit current version", async () => {
    expect((await POST(req(), ctx)).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("sync_payroll_run", {
      p_run_id: id,
      p_expected_version: 1,
    });
  });
  it.each([
    {},
    { expectedVersion: null },
    { expectedVersion: 0 },
    { expectedVersion: 1.5 },
    { expectedVersion: 2147483648 },
    { expectedVersion: 1, role: "ADMIN_HR" },
  ])("rejects malformed sync payload %#", async (body) => {
    expect((await POST(req(body), ctx)).status).toBe(422);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it.each(["MANAGER", "EMPLOYEE"])(
    "%s cannot read readiness or synchronize",
    async (role) => {
      mock.actor.mockResolvedValue({
        role,
        accountStatus: "ACTIVE",
        employeeStatus: "ACTIVE",
      });
      expect((await GET(new Request("https://hris.test"), ctx)).status).toBe(
        403,
      );
      expect((await POST(req(), ctx)).status).toBe(403);
      expect(mock.rpc).not.toHaveBeenCalled();
    },
  );
});
