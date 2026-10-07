import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";

export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "ADMIN_HR") throw api.forbidden();
    const key = request.headers.get("Idempotency-Key");
    if (!isUuid(key))
      throw api.validation({ "Idempotency-Key": ["Header UUID wajib diisi"] });
    const body = await readJson(request);
    if (Object.keys(body).some((k) => !["employeeId", "role"].includes(k)))
      throw api.validation({ body: ["Field tidak dikenal"] });
    const employeeId = String(body.employeeId ?? "");
    const role = String(body.role ?? "");
    if (
      !isUuid(employeeId) ||
      !["ADMIN_HR", "MANAGER", "EMPLOYEE"].includes(role)
    )
      throw api.validation({ account: ["Karyawan/peran tidak valid"] });
    const hash = createHash("sha256")
      .update(JSON.stringify({ employeeId, role, v: 1 }))
      .digest("hex");
    const { data: claim, error: claimError } = await supabase.rpc(
      "claim_account_invitation",
      {
        p_key: key,
        p_employee: employeeId,
        p_role: role,
        p_hash: hash,
      },
    );
    if (claimError) throw toApiError(claimError);
    if (claim.state === "SUCCEEDED")
      return ok(claim.account, {}, { status: 202 });
    const admin = createSupabaseAdminClient();
    const origin = new URL(request.url).origin;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(
      claim.email,
      {
        redirectTo: `${origin}/auth/confirm?type=invite`,
      },
    );
    // Keep PROCESSING on uncertain outcomes. A same-key retry never sends a second email.
    // Operator reconciles by operationId + Auth email, then calls finish RPC once.
    if (error || !data.user)
      throw api.serviceUnavailable(
        "Undangan belum selesai. Jangan buat kunci baru; minta HR memeriksa status provisioning.",
      );
    const { error: recordError } = await admin.rpc(
      "record_invitation_external",
      {
        p_operation: claim.operationId,
        p_auth_user: data.user.id,
      },
    );
    if (recordError)
      throw api.serviceUnavailable(
        "Akun Auth dibuat; penyambungan perlu rekonsiliasi HR, bukan undangan baru.",
      );
    const { data: account, error: finishError } = await admin.rpc(
      "finish_account_invitation",
      {
        p_operation: claim.operationId,
        p_auth_user: data.user.id,
      },
    );
    if (finishError)
      throw api.serviceUnavailable(
        "Akun Auth tercatat; HR perlu menyelesaikan penyambungan akun.",
      );
    return ok(account, {}, { status: 202 });
  });
}
