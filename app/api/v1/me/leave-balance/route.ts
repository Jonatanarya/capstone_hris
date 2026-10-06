import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { toApiError } from "@/lib/api/errors";

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const year = Number(url.searchParams.get("year"));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw api.invalidQuery("Parameter year wajib integer 2000–2100");
    }

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);

    const { data, error } = await supabase.rpc("leave_balance", {
      p_employee: actor.employeeId,
      p_year: year,
    });
    if (error) throw toApiError(error);

    const row = Array.isArray(data) ? data[0] : data;
    return ok({
      year: row?.year ?? year,
      entitlementDays: row?.entitlement_days ?? 0,
      usedDays: row?.used_days ?? 0,
      reservedDays: row?.reserved_days ?? 0,
      availableDays: row?.available_days ?? 0,
    });
  });
}