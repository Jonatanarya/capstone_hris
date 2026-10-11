import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  actor: vi.fn(),
  rpc: vi.fn(),
  verify: vi.fn(),
  update: vi.fn(),
  signOut: vi.fn(),
  verifierOut: vi.fn(),
  from: vi.fn(),
  query: { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: mock.rpc,
    from: mock.from,
    auth: {
      getUser: async () => ({
        data: { user: { id: "own-user", email: "own@example.test" } },
      }),
      updateUser: mock.update,
      signOut: mock.signOut,
    },
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { signInWithPassword: mock.verify, signOut: mock.verifierOut },
  }),
}));
vi.mock("@/lib/supabase/env", () => ({
  requireSupabaseEnv: () => ({
    url: "https://project.supabase.co",
    publishableKey: "public-test",
  }),
}));
vi.mock("@/lib/api/actor", async (original) => ({
  ...(await original<typeof import("../lib/api/actor")>()),
  getActor: mock.actor,
}));
import { PATCH as password } from "../app/api/v1/me/password/route";
import { GET as payslips } from "../app/api/v1/me/payslips/route";
import { PATCH as policy } from "../app/api/v1/hr-policy/route";
import { POST as correctionDecision } from "../app/api/v1/attendance-corrections/[id]/decision/route";
import { POST as cancel } from "../app/api/v1/leave-requests/[id]/cancel/route";
import { PUT as saveKpi, GET as kpis } from "../app/api/v1/kpis/route";
import { POST as publishKpi } from "../app/api/v1/kpis/[id]/publish/route";
import { kpiTemplate } from "../lib/kpi";
const id = "a0000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ id }) };
const req = (body: unknown) =>
  new Request("https://hris.test/api/v1/me/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.actor.mockResolvedValue({
    userId: "own-user",
    employeeId: id,
    role: "EMPLOYEE",
    accountStatus: "ACTIVE",
    employeeStatus: "ACTIVE",
  });
  mock.verify.mockResolvedValue({
    data: { user: { id: "own-user" } },
    error: null,
  });
  mock.update.mockResolvedValue({ error: null });
  mock.rpc.mockResolvedValue({ data: { id }, error: null });
  mock.from.mockReturnValue(mock.query);
  for (const name of ["select", "eq", "order"] as const)
    mock.query[name].mockReturnValue(mock.query);
  mock.query.range.mockResolvedValue({ data: [], error: null, count: 0 });
});
describe("personal and HR workflow routes", () => {
  it.each(["EMPLOYEE", "ADMIN_HR"])(
    "%s cannot save or publish KPI",
    async (role) => {
      mock.actor.mockResolvedValue({
        role,
        accountStatus: "ACTIVE",
        employeeStatus: "ACTIVE",
        employeeId: id,
      });
      expect((await saveKpi(req({}))).status).toBe(403);
      expect((await publishKpi(req({}), context)).status).toBe(403);
      expect(mock.rpc).not.toHaveBeenCalled();
    },
  );
  it("employee KPI list explicitly scopes own published only", async () => {
    expect(
      (await kpis(new Request("https://hris.test/api/v1/kpis?period=2026-10")))
        .status,
    ).toBe(200);
    expect(mock.query.eq).toHaveBeenCalledWith("employee_id", id);
    expect(mock.query.eq).toHaveBeenCalledWith("status", "PUBLISHED");
  });
  it("manager saves draft with strict version and no client score", async () => {
    mock.actor.mockResolvedValue({
      role: "MANAGER",
      accountStatus: "ACTIVE",
      employeeStatus: "ACTIVE",
      employeeId: id,
    });
    const body = {
      employeeId: id,
      period: "2026-10",
      indicators: kpiTemplate(),
      notes: "",
      expectedVersion: null,
    };
    expect((await saveKpi(req({ ...body, score: 100 }))).status).toBe(422);
    expect((await saveKpi(req({ ...body, expectedVersion: "1" }))).status).toBe(
      422,
    );
    expect((await saveKpi(req(body))).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("save_kpi", {
      p_employee_id: id,
      p_period: "2026-10",
      p_indicators: body.indicators,
      p_notes: "",
      p_expected_version: null,
    });
  });
  it("publish requires explicit review version and maps immutable final errors", async () => {
    mock.actor.mockResolvedValue({
      role: "MANAGER",
      accountStatus: "ACTIVE",
      employeeStatus: "ACTIVE",
      employeeId: id,
    });
    expect(
      (await publishKpi(req({ expectedVersion: 1 }), context)).status,
    ).toBe(422);
    mock.rpc.mockResolvedValue({
      data: null,
      error: { message: "KPI_FINALIZED" },
    });
    expect(
      (
        await publishKpi(
          req({ expectedVersion: 1, expectedReviewVersion: null }),
          context,
        )
      ).status,
    ).toBe(409);
    expect(mock.rpc).toHaveBeenCalledWith("publish_kpi", {
      p_id: id,
      p_expected_version: 1,
      p_expected_review_version: null,
    });
  });
  it("changes own password only after verifying current credentials", async () => {
    expect(
      (
        await password(
          req({
            currentPassword: "current-demo",
            newPassword: "new-demo-password",
          }),
        )
      ).status,
    ).toBe(200);
    expect(mock.verify).toHaveBeenCalledWith({
      email: "own@example.test",
      password: "current-demo",
    });
    expect(mock.update).toHaveBeenCalledWith({
      password: "new-demo-password",
      current_password: "current-demo",
    });
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mock.verifierOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("wrong current password never updates credentials", async () => {
    mock.verify.mockResolvedValue({
      data: { user: null },
      error: new Error("Wrong"),
    });
    expect(
      (
        await password(
          req({ currentPassword: "wrong", newPassword: "new-demo-password" }),
        )
      ).status,
    ).toBe(422);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("verification must match the signed-in user", async () => {
    mock.verify.mockResolvedValue({
      data: { user: { id: "someone-else" } },
      error: null,
    });
    expect(
      (
        await password(
          req({
            currentPassword: "current-demo",
            newPassword: "new-demo-password",
          }),
        )
      ).status,
    ).toBe(403);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it.each([
    { currentPassword: "x", newPassword: "short" },
    { currentPassword: "same-password", newPassword: "same-password" },
    {
      currentPassword: "x",
      newPassword: "new-demo-password",
      employeeId: "other",
    },
  ])("rejects malformed password payload %#", async (body) => {
    expect((await password(req(body))).status).toBe(422);
    expect(mock.verify).not.toHaveBeenCalled();
  });
  it.each(["ADMIN_HR", "MANAGER", "EMPLOYEE"])(
    "%s personal slips are explicitly scoped to own published items",
    async (role) => {
      mock.actor.mockResolvedValue({
        userId: "own-user",
        employeeId: id,
        role,
        accountStatus: "ACTIVE",
        employeeStatus: "ACTIVE",
      });
      expect(
        (
          await payslips(
            new Request(
              "https://hris.test/api/v1/me/payslips?employeeId=another",
            ),
          )
        ).status,
      ).toBe(200);
      expect(mock.query.eq).toHaveBeenCalledWith("employee_id", id);
      expect(mock.query.eq).toHaveBeenCalledWith("status", "PUBLISHED");
      expect(mock.query.eq).toHaveBeenCalledWith(
        "payroll_runs.status",
        "PUBLISHED",
      );
    },
  );
  it.each(["MANAGER", "EMPLOYEE"])(
    "%s cannot edit policy or decide corrections",
    async (role) => {
      mock.actor.mockResolvedValue({
        role,
        accountStatus: "ACTIVE",
        employeeStatus: "ACTIVE",
      });
      expect((await policy(req({}))).status).toBe(403);
      expect(
        (
          await correctionDecision(
            req({ decision: "APPROVED", note: "Test", expectedVersion: 1 }),
            context,
          )
        ).status,
      ).toBe(403);
      expect(mock.rpc).not.toHaveBeenCalled();
    },
  );
  it("cancel RPC does not accept a caller-controlled owner", async () => {
    expect(
      (
        await cancel(
          req({ expectedVersion: 1, employeeId: "another" }),
          context,
        )
      ).status,
    ).toBe(422);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect((await cancel(req({ expectedVersion: 1 }), context)).status).toBe(
      200,
    );
    expect(mock.rpc).toHaveBeenCalledWith("cancel_leave_request", {
      p_id: id,
      p_expected_version: 1,
    });
  });
  it("inactive users cannot use new endpoints", async () => {
    mock.actor.mockResolvedValue({
      role: "ADMIN_HR",
      accountStatus: "DISABLED",
      employeeStatus: "ACTIVE",
    });
    expect(
      (
        await password(
          req({ currentPassword: "x", newPassword: "new-demo-password" }),
        )
      ).status,
    ).toBe(403);
    expect(mock.verify).not.toHaveBeenCalled();
    expect(
      (await payslips(new Request("https://hris.test/api/v1/me/payslips")))
        .status,
    ).toBe(403);
  });
});
