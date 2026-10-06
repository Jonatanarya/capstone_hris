import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";

const ROLES = ["ADMIN_HR", "MANAGER", "EMPLOYEE"] as const;
const STATUSES = ["INVITED", "ACTIVE", "DISABLED"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  return handle(async () => {
    const { userId } = await params;
    if (!isUuid(userId)) throw api.notFound();

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "ADMIN_HR") throw api.forbidden();

    const body = (await readJson(request)) as Record<string, unknown>;
    const allowed = new Set(["role", "accountStatus", "expectedVersion"]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) throw api.validation({ [key]: ["Field tidak dikenal"] });
    }
    const expectedVersion = Number(body.expectedVersion);
    const fieldErrors: Record<string, string[]> = {};
    if (body.role !== undefined && !ROLES.includes(body.role as (typeof ROLES)[number])) {
      fieldErrors.role = ["Nilai tidak dikenal"];
    }
    if (
      body.accountStatus !== undefined &&
      !STATUSES.includes(body.accountStatus as (typeof STATUSES)[number])
    ) {
      fieldErrors.accountStatus = ["Nilai tidak dikenal"];
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      fieldErrors.expectedVersion = ["Wajib integer >= 1"];
    }
    if (Object.keys(fieldErrors).length) throw api.validation(fieldErrors);

    const { data, error } = await supabase.rpc("update_account", {
      p_user_id: userId,
      p_role: body.role ?? null,
      p_account_status: body.accountStatus ?? null,
      p_expected_version: expectedVersion,
    });
    if (error) throw toApiError(error);

    const p = data as { user_id: string; employee_id: string; role: string; account_status: string; version: number };
    return ok({
      userId: p.user_id,
      employeeId: p.employee_id,
      role: p.role,
      accountStatus: p.account_status,
      version: p.version,
    });
  });
}