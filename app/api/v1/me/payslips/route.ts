import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handle, listOk } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";
import {
  PAYROLL_ITEM_SELECT,
  payrollItemDto,
  type PayrollItemRow,
} from "@/lib/api/payroll";

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    const { page, pageSize, from, to } = pagination(request);
    // Scope explicitly by the actor, including HR. A query parameter cannot select a colleague.
    const { data, error, count } = await supabase
      .from("payroll_items")
      .select(
        PAYROLL_ITEM_SELECT + ",payroll_runs!inner(period,status,published_at)",
        { count: "exact" },
      )
      .eq("employee_id", actor.employeeId)
      .eq("status", "PUBLISHED")
      .eq("payroll_runs.status", "PUBLISHED")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
    if (error) throw toApiError(error);
    return listOk(
      (
        data as unknown as (PayrollItemRow & {
          payroll_runs: { period: string; published_at: string };
        })[]
      ).map((r) => ({
        ...payrollItemDto(r),
        period: r.payroll_runs.period,
        publishedAt: r.payroll_runs.published_at,
      })),
      page,
      pageSize,
      count ?? 0,
    );
  });
}
