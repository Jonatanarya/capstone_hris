import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, listOk } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";
import { isUuid } from "@/lib/api/dto";

type ReviewRow = {
  id: string;
  employee_id: string;
  period: string;
  score: number;
  notes: string;
  assessed_by: string;
  assessed_at: string;
  version: number;
  employees: { full_name: string } | null;
};

function reviewDto(r: ReviewRow) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employees?.full_name ?? null,
    period: r.period,
    score: r.score,
    notes: r.notes,
    assessedBy: r.assessed_by,
    assessedAt: r.assessed_at,
    version: r.version,
  };
}

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);

    const { url, page, pageSize, from, to } = pagination(request);
    const period = url.searchParams.get("period");
    if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw api.invalidQuery("period wajib YYYY-MM");
    }

    let employeeId = url.searchParams.get("employeeId");
    if (actor.role === "EMPLOYEE") employeeId = actor.employeeId;
    if (employeeId && !isUuid(employeeId))
      throw api.invalidQuery("employeeId tidak valid");

    let query = supabase
      .from("performance_reviews")
      .select(
        "id, employee_id, period, score, notes, assessed_by, assessed_at, version, employees(full_name)",
        { count: "exact" },
      )
      .eq("period", period)
      .order("assessed_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);
    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data, error, count } = await query;
    if (error) throw toApiError(error);
    return listOk(
      (data as unknown as ReviewRow[]).map(reviewDto),
      page,
      pageSize,
      count ?? 0,
    );
  });
}
