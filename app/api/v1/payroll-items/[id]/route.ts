import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";
import { payrollItemDto, type PayrollItemRow } from "@/lib/api/payroll";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    if (!isUuid(id)) throw api.notFound();

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "ADMIN_HR") throw api.forbidden();

    const body = (await readJson(request)) as Record<string, unknown>;
    const allowed = new Set([
      "allowanceIdr",
      "bonusIdr",
      "deductionIdr",
      "expectedVersion",
    ]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key))
        throw api.validation({ [key]: ["Field tidak dikenal"] });
    }
    const nums = {
      p_allowance_idr: Number(body.allowanceIdr),
      p_bonus_idr: Number(body.bonusIdr),
      p_deduction_idr: Number(body.deductionIdr),
    };
    const expectedVersion = Number(body.expectedVersion);
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(nums)) {
      if (!Number.isSafeInteger(value) || value < 0)
        fieldErrors[key] = ["Integer >= 0"];
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      fieldErrors.expectedVersion = ["Wajib integer >= 1"];
    }
    if (Object.keys(fieldErrors).length) throw api.validation(fieldErrors);

    const { data, error } = await supabase.rpc("update_payroll_item", {
      p_item_id: id,
      ...nums,
      p_expected_version: expectedVersion,
    });
    if (error) throw toApiError(error);
    return ok(payrollItemDto(data as PayrollItemRow));
  });
}
