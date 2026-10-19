import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, listOk, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";
import { isUuid } from "@/lib/api/dto";
import { workflowBody, workflowVersion } from "@/lib/api/workflows";
import { kpiDto, kpiPeriod, type KpiRow } from "@/lib/api/kpi";
import { validateIndicators } from "@/lib/kpi";

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    const { url, page, pageSize, from, to } = pagination(request);
    const period = kpiPeriod(url.searchParams.get("period"));
    let query = supabase
      .from("kpi_assessments")
      .select(
        "id,employee_id,period,indicators,notes,status,score,version,published_at,goals_shared_at,employees(full_name)",
        { count: "exact" },
      )
      .eq("period", period)
      .order("updated_at", { ascending: false })
      .order("id");
    if (actor.role === "EMPLOYEE")
      query = query
        .eq("employee_id", actor.employeeId)
        .eq("status", "PUBLISHED");
    const { data, error, count } = await query.range(from, to);
    if (error) throw toApiError(error);
    return listOk(
      ((data as unknown as KpiRow[]) ?? []).map(kpiDto),
      page,
      pageSize,
      count ?? 0,
    );
  });
}
export async function PUT(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    requireRole(actor, "MANAGER", "ADMIN_HR");
    const body = (await readJson(request)) as Record<string, unknown>;
    workflowBody(body, [
      "employeeId",
      "period",
      "indicators",
      "notes",
      "expectedVersion",
    ]);
    if (typeof body.employeeId !== "string" || !isUuid(body.employeeId))
      throw api.validation({ employeeId: ["Karyawan tidak valid"] });
    if (!validateIndicators(body.indicators))
      throw api.validation({
        indicators: [
          "Isi 1–10 indikator unik, target > 0, realisasi ≥ 0, dan total bobot tepat 100%.",
        ],
      });
    if (typeof body.notes !== "string" || body.notes.length > 2000)
      throw api.validation({ notes: ["Catatan maksimal 2000 karakter"] });
    if (
      actor.role === "MANAGER" &&
      (body.notes.trim() ||
        body.indicators.some((i) => i.actual !== null || i.evidence?.trim()))
    )
      throw api.forbidden(
        "Manager menetapkan target; realisasi dan penilaian diisi Admin HR.",
      );
    const version =
      body.expectedVersion === null
        ? null
        : workflowVersion(body.expectedVersion);
    const { data, error } = await supabase.rpc("save_kpi", {
      p_employee_id: body.employeeId,
      p_period: kpiPeriod(body.period),
      p_indicators: body.indicators,
      p_notes: body.notes.trim(),
      p_expected_version: version,
    });
    if (error) throw toApiError(error);
    return ok(kpiDto(data as KpiRow));
  });
}
