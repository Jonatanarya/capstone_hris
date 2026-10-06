import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, listOk } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";
import { isUuid } from "@/lib/api/dto";
import {
  PAYROLL_ITEM_SELECT as SELECT,
  payrollItemDto,
  type PayrollItemRow,
} from "@/lib/api/payroll";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    if (!isUuid(id)) throw api.notFound();

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role === "MANAGER") throw api.forbidden();

    const { page, pageSize, from, to } = pagination(request);
    const { data, error, count } = await supabase
      .from("payroll_items")
      .select(SELECT, { count: "exact" })
      .eq("payroll_run_id", id)
      .order("full_name", { ascending: true })
      .range(from, to);
    if (error) throw toApiError(error);
    return listOk(
      (data as unknown as PayrollItemRow[]).map(payrollItemDto),
      page,
      pageSize,
      count ?? 0,
    );
  });
}