import { beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  invite: vi.fn(),
  actor: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: mocked.rpc }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: mocked.adminRpc,
    auth: { admin: { inviteUserByEmail: mocked.invite } },
  }),
}));
vi.mock("@/lib/api/actor", () => ({
  getActor: mocked.actor,
  assertActive: vi.fn(),
}));
import { POST } from "../app/api/v1/accounts/invite/route";
const employeeId = "e0000000-0000-4000-8000-000000000002";
const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const req = (
  body: unknown = { employeeId, role: "EMPLOYEE" },
  idempotencyKey = key,
) =>
  new Request("https://hris.test/api/v1/accounts/invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocked.actor.mockResolvedValue({ role: "ADMIN_HR", userId: "hr" });
  mocked.rpc.mockResolvedValue({
    data: {
      state: "PROCESSING",
      operationId: key,
      email: "fixture@example.test",
    },
    error: null,
  });
  mocked.invite.mockResolvedValue({
    data: { user: { id: employeeId } },
    error: null,
  });
  mocked.adminRpc.mockResolvedValue({
    data: { userId: employeeId, accountStatus: "INVITED" },
    error: null,
  });
});
describe("invitation provisioning — mocked Auth, never sends email", () => {
  it("claims, records external identity, finalizes in that order", async () => {
    expect((await POST(req())).status).toBe(202);
    expect(mocked.rpc).toHaveBeenCalledWith(
      "claim_account_invitation",
      expect.objectContaining({
        p_key: key,
        p_employee: employeeId,
        p_role: "EMPLOYEE",
      }),
    );
    expect(mocked.invite).toHaveBeenCalledTimes(1);
    expect(mocked.invite).toHaveBeenCalledWith("fixture@example.test", {
      redirectTo: "https://hris.test/auth/confirm?type=invite",
    });
    expect(mocked.adminRpc.mock.calls.map((args) => args[0])).toEqual([
      "record_invitation_external",
      "finish_account_invitation",
    ]);
  });
  it("replayed success returns stored result without another invite", async () => {
    mocked.rpc.mockResolvedValue({
      data: { state: "SUCCEEDED", account: { userId: employeeId } },
      error: null,
    });
    expect((await POST(req())).status).toBe(202);
    expect(mocked.invite).not.toHaveBeenCalled();
  });
  it.each(["OPERATION_IN_PROGRESS", "IDEMPOTENCY_CONFLICT"])(
    "%s never sends email",
    async (code) => {
      mocked.rpc.mockResolvedValue({ data: null, error: { message: code } });
      expect((await POST(req())).status).toBe(409);
      expect(mocked.invite).not.toHaveBeenCalled();
    },
  );
  it("does not retry/delete Auth after an uncertain external failure", async () => {
    mocked.invite.mockResolvedValue({
      data: {},
      error: { message: "timeout" },
    });
    expect((await POST(req())).status).toBe(503);
    expect(mocked.invite).toHaveBeenCalledTimes(1);
    expect(mocked.adminRpc).not.toHaveBeenCalled();
  });
  it("records external user before profile finalization fails", async () => {
    mocked.adminRpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ error: { message: "write failure" } });
    expect((await POST(req())).status).toBe(503);
    expect(mocked.adminRpc.mock.calls[0][0]).toBe("record_invitation_external");
    expect(mocked.invite).toHaveBeenCalledTimes(1);
  });
  it("rejects employee actor and malformed JSON before external calls", async () => {
    mocked.actor.mockResolvedValue({ role: "EMPLOYEE" });
    expect((await POST(req())).status).toBe(403);
    mocked.actor.mockResolvedValue({ role: "ADMIN_HR" });
    expect((await POST(req(null))).status).toBe(400);
    expect(
      (await POST(req({ employeeId, role: "EMPLOYEE", surprise: true })))
        .status,
    ).toBe(422);
    expect(mocked.invite).not.toHaveBeenCalled();
  });
});
