import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { api, handle, listOk } from "@/lib/api/http";
import { kpiPeriod } from "@/lib/api/kpi";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";
import type { MonthlyReportRow } from "@/lib/lecturer-revision";

export async function GET(request: Request) {
  return handle(async () => {
    const db = await createSupabaseServerClient();
    const actor = await getActor(db);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR", "MANAGER");
    const { url, from, to, page, pageSize } = pagination(request);
    const { data, error } = await db.rpc("monthly_performance_report", {
      p_period: kpiPeriod(url.searchParams.get("period")),
    });
    if (error) throw toApiError(error);
    const rows = (data ?? []) as MonthlyReportRow[];
    if (rows.length > 10000)
      throw api.validation({ report: ["Batas laporan 10.000 karyawan"] });
    return listOk(rows.slice(from, to + 1), page, pageSize, rows.length);
  });
}
