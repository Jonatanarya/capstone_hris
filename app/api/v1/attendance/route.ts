import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, listOk } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";
import { isUuid } from "@/lib/api/dto";
import { jakartaDate } from "@/lib/hris";

type AttendanceRow = {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  version: number;
};

function attendanceDto(a: AttendanceRow) {
  return {
    id: a.id,
    employeeId: a.employee_id,
    workDate: a.work_date,
    checkInAt: a.check_in_at,
    checkOutAt: a.check_out_at,
    status: a.status,
    version: a.version,
  };
}

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);

    const { url, page, pageSize, from, to } = pagination(request);
    const workDate = url.searchParams.get("date") ?? jakartaDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) throw api.invalidQuery("Tanggal tidak valid");

    let employeeId = url.searchParams.get("employeeId");
    if (actor.role === "EMPLOYEE") employeeId = actor.employeeId;
    if (employeeId && !isUuid(employeeId)) throw api.invalidQuery("employeeId tidak valid");

    let query = supabase
      .from("attendances")
      .select(
        "id, employee_id, work_date, check_in_at, check_out_at, status, version",
        { count: "exact" },
      )
      .eq("work_date", workDate)
      .order("id", { ascending: true })
      .range(from, to);
    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data, error, count } = await query;
    if (error) throw toApiError(error);
    return listOk(
      (data as AttendanceRow[]).map(attendanceDto),
      page,
      pageSize,
      count ?? 0,
    );
  });
}