import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertActive, getActor } from "@/lib/api/actor";
import { handle, listOk } from "@/lib/api/http";
import { toApiError } from "@/lib/api/errors";
import { pagination } from "@/lib/api/query";
import { kpiPeriod } from "@/lib/api/kpi";
import type { KpiGoalDto } from "@/lib/kpi";
export async function GET(request: Request) {
  return handle(async () => {
    const db = await createSupabaseServerClient();
    const actor = await getActor(db);
    assertActive(actor);
    const { url, page, pageSize, from, to } = pagination(request);
    let query = db
      .from("kpi_goal_plans")
      .select(
        "assessment_id,employee_id,period,indicators,shared_at,employees(full_name)",
        { count: "exact" },
      )
      .eq("period", kpiPeriod(url.searchParams.get("period")))
      .order("shared_at", { ascending: false })
      .order("assessment_id");
    if (actor.role === "EMPLOYEE")
      query = query.eq("employee_id", actor.employeeId);
    const { data, error, count } = await query.range(from, to);
    if (error) throw toApiError(error);
    const rows = (data ?? []) as unknown as {
      assessment_id: string;
      employee_id: string;
      period: string;
      indicators: KpiGoalDto["indicators"];
      shared_at: string;
      employees: { full_name: string } | null;
    }[];
    return listOk(
      rows.map((r) => ({
        id: r.assessment_id,
        employeeId: r.employee_id,
        employeeName: r.employees?.full_name ?? "",
        period: r.period,
        indicators: r.indicators,
        sharedAt: r.shared_at,
      })),
      page,
      pageSize,
      count ?? 0,
    );
  });
}
