import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { toApiError } from "@/lib/api/errors";
import { jakartaDate } from "@/lib/hris";
import { exportRows } from "@/lib/api/export";

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);

    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? jakartaDate().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
      throw api.invalidQuery("period harus YYYY-MM");
    const workDate = url.searchParams.get("workDate") ?? jakartaDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate))
      throw api.invalidQuery("workDate tidak valid");

    const head = { count: "exact" as const, head: true };

    const [
      employeeCount,
      activeEmployeeCount,
      presentCount,
      pendingLeaveCount,
    ] = await Promise.all([
      supabase.from("employees").select("id", head),
      supabase
        .from("employees")
        .select("id", head)
        .eq("employment_status", "ACTIVE"),
      supabase
        .from("attendances")
        .select("id", head)
        .eq("work_date", workDate)
        .not("check_in_at", "is", null),
      supabase
        .from("leave_requests")
        .select("id", head)
        .eq("status", "PENDING"),
    ]);

    const reviews = await exportRows((from, to) =>
      supabase
        .from("performance_reviews")
        .select("score", { count: "exact" })
        .eq("period", period)
        .order("id")
        .range(from, to),
    );
    const scores = (reviews ?? []).map((r) => r.score as number);
    const averageReviewScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;

    const emps = await exportRows((from, to) =>
      supabase
        .from("employees")
        .select("departments(name)", { count: "exact" })
        .eq("employment_status", "ACTIVE")
        .order("id")
        .range(from, to),
    );
    const distribution = new Map<string, number>();
    for (const row of (emps ?? []) as unknown as {
      departments: { name: string } | null;
    }[]) {
      const name = row.departments?.name ?? "Tanpa departemen";
      distribution.set(name, (distribution.get(name) ?? 0) + 1);
    }

    const { data: recent, error: recentError } = await supabase
      .from("leave_requests")
      .select("id, employee_id, type, start_date, end_date, status")
      .order("submitted_at", { ascending: false })
      .limit(5);
    if (recentError) throw toApiError(recentError);

    const scope =
      actor.role === "ADMIN_HR"
        ? "ORGANIZATION"
        : actor.role === "MANAGER"
          ? "DEPARTMENT"
          : "SELF";

    const result: Record<string, unknown> = {
      scope,
      period,
      workDate,
      employeeCount: employeeCount.count ?? 0,
      activeEmployeeCount: activeEmployeeCount.count ?? 0,
      presentCount: presentCount.count ?? 0,
      pendingLeaveCount: pendingLeaveCount.count ?? 0,
      averageReviewScore,
      reviewedEmployeeCount: scores.length,
      departmentDistribution: Array.from(distribution, ([name, count]) => ({
        name,
        count,
      })),
      recentLeaveRequests: (recent ?? []).map((l) => ({
        id: l.id,
        employeeId: l.employee_id,
        type: l.type,
        startDate: l.start_date,
        endDate: l.end_date,
        status: l.status,
      })),
    };

    if (actor.role === "EMPLOYEE") {
      const { data: myAttendance, error: attendanceError } = await supabase
        .from("attendances")
        .select("id, work_date, check_in_at, check_out_at, status")
        .eq("employee_id", actor.employeeId)
        .eq("work_date", workDate)
        .maybeSingle();
      if (attendanceError) throw toApiError(attendanceError);
      const { data: balance, error: balanceError } = await supabase.rpc(
        "leave_balance",
        {
          p_employee: actor.employeeId,
          p_year: Number(period.slice(0, 4)),
        },
      );
      if (balanceError) throw toApiError(balanceError);
      result.myAttendance = myAttendance ?? null;
      result.leaveBalance = Array.isArray(balance)
        ? (balance[0] ?? null)
        : balance;
    }

    for (const result of [
      employeeCount,
      activeEmployeeCount,
      presentCount,
      pendingLeaveCount,
    ]) {
      if (result.error) throw toApiError(result.error);
    }
    return ok(result);
  });
}
