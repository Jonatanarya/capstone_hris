import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { api, handle, newRequestId, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";

const ROLES = ["ADMIN_HR", "MANAGER", "EMPLOYEE"] as const;

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "ADMIN_HR") throw api.forbidden();

    const key = request.headers.get("Idempotency-Key")?.trim() ?? "";
    if (!isUuid(key)) {
      throw api.validation({ "Idempotency-Key": ["Header UUID wajib diisi"] });
    }

    const body = (await readJson(request)) as Record<string, unknown>;
    const employeeId = String(body.employeeId ?? "");
    const role = String(body.role ?? "");
    const fieldErrors: Record<string, string[]> = {};
    if (!isUuid(employeeId)) fieldErrors.employeeId = ["UUID tidak valid"];
    if (!ROLES.includes(role as (typeof ROLES)[number])) fieldErrors.role = ["Nilai tidak dikenal"];
    if (Object.keys(fieldErrors).length) throw api.validation(fieldErrors);

    const payloadHash = await sha256(JSON.stringify({ employeeId, role, v: 1 }));
    const admin = createSupabaseAdminClient();

    const { data: existing } = await admin
      .from("operation_requests")
      .select("id, state, payload_hash, result_account")
      .eq("actor_user_id", actor.userId)
      .eq("operation", "account.invite")
      .eq("idempotency_key", key)
      .maybeSingle<{
        id: string;
        state: string;
        payload_hash: string;
        result_account: Record<string, unknown> | null;
      }>();

    if (existing) {
      if (existing.payload_hash !== payloadHash) {
        throw api.conflict("IDEMPOTENCY_CONFLICT", "Kunci dipakai untuk payload berbeda");
      }
      if (existing.state === "PROCESSING") {
        throw api.conflict("OPERATION_IN_PROGRESS", "Operasi masih diproses");
      }
      if (existing.state === "SUCCEEDED") {
        return Response.json(
          { data: existing.result_account, meta: { requestId: newRequestId() } },
          { status: 202 },
        );
      }
    }

    const { data: emp } = await supabase
      .from("employees")
      .select("id, work_email, employment_status")
      .eq("id", employeeId)
      .maybeSingle<{ id: string; work_email: string; employment_status: string }>();
    if (!emp) throw api.notFound();
    if (emp.employment_status !== "ACTIVE") {
      throw api.validation({ employeeId: ["Karyawan tidak aktif"] });
    }

    const { data: linked } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (linked) throw api.conflict("DUPLICATE_EMAIL", "Karyawan sudah memiliki akun");

    let opId: string;
    if (existing) {
      await admin
        .from("operation_requests")
        .update({ state: "PROCESSING", failure_code: null })
        .eq("id", existing.id);
      opId = existing.id;
    } else {
      const { data: ins, error } = await admin
        .from("operation_requests")
        .insert({
          actor_user_id: actor.userId,
          operation: "account.invite",
          idempotency_key: key,
          payload_hash: payloadHash,
          employee_id: employeeId,
          state: "PROCESSING",
        })
        .select("id")
        .single<{ id: string }>();
      if (error) throw toApiError(error);
      opId = ins.id;
    }

    try {
      const origin = new URL(request.url).origin;
      const { data: created, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        emp.work_email,
        { redirectTo: `${origin}/api/v1/auth/callback` },
      );
      if (inviteError || !created?.user) {
        throw new Error(inviteError?.message ?? "invite failed");
      }

      const { error: profileError } = await admin
        .from("user_profiles")
        .upsert(
          {
            user_id: created.user.id,
            employee_id: employeeId,
            role,
            account_status: "INVITED",
          },
          { onConflict: "user_id" },
        );
      if (profileError) throw profileError;

      const account = {
        userId: created.user.id,
        employeeId,
        role,
        accountStatus: "INVITED",
      };
      await admin
        .from("operation_requests")
        .update({
          state: "SUCCEEDED",
          external_auth_user_id: created.user.id,
          result_account: account,
        })
        .eq("id", opId);

      return Response.json(
        { data: account, meta: { requestId: newRequestId() } },
        { status: 202 },
      );
    } catch (error) {
      console.error("INVITE_PROVISION_FAILED", error);
      await admin
        .from("operation_requests")
        .update({ state: "FAILED", failure_code: "PROVISION_FAILED" })
        .eq("id", opId);
      throw api.serviceUnavailable(
        "Gagal menyambungkan akun Auth; ulangi dengan kunci idempotensi yang sama",
      );
    }
  });
}