import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { csvCell, jakartaDate } from "@/lib/hris";
import { exportRows } from "@/lib/api/export";
import { isUuid } from "@/lib/api/dto";
import { requireEnum } from "@/lib/api/query";

const KINDS = [
  "employees",
  "attendance",
  "leave",
  "payroll",
  "performance",
] as const;
type Kind = (typeof KINDS)[number];

function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows]
    .map((row) => row.map((v) => csvCell(v)).join(","))
    .join("\r\n");
}

function csvResponse(filename: string, body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  return handle(async () => {
    const { kind } = await params;
    if (!KINDS.includes(kind as Kind)) throw api.notFound();

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);

    const isHr = actor.role === "ADMIN_HR";
    if (!isHr && !(actor.role === "EMPLOYEE" && kind === "payroll")) {
      throw api.forbidden();
    }

    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? undefined;
    const date = url.searchParams.get("date") ?? jakartaDate();
    if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
      throw api.invalidQuery("period harus YYYY-MM");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    )
      throw api.invalidQuery("date tidak valid");

    if (kind === "employees") {
      const q = (url.searchParams.get("q") ?? "")
        .replace(/[,()%]/g, " ")
        .trim()
        .slice(0, 100);
      const departmentId = url.searchParams.get("departmentId");
      if (departmentId && !isUuid(departmentId))
        throw api.invalidQuery("departmentId harus UUID");
      const employmentStatus = requireEnum(
        url.searchParams.get("employmentStatus"),
        ["ACTIVE", "INACTIVE"],
        "employmentStatus",
      );
      const data = await exportRows((from, to) => {
        let query = supabase
          .from("employees")
          .select(
            "employee_no, full_name, work_email, employment_status, joined_on, departments(name), positions(name)",
            { count: "exact" },
          )
          .order("full_name", { ascending: true })
          .order("id")
          .range(from, to);
        if (q)
          query = query.or(
            `full_name.ilike.%${q}%,employee_no.ilike.%${q}%,work_email.ilike.%${q}%`,
          );
        if (departmentId) query = query.eq("department_id", departmentId);
        if (employmentStatus)
          query = query.eq("employment_status", employmentStatus);
        return query;
      });
      const rows = (data as unknown as Record<string, unknown>[]).map((e) => [
        e.employee_no,
        e.full_name,
        e.work_email,
        (e.departments as { name?: string } | null)?.name ?? "",
        (e.positions as { name?: string } | null)?.name ?? "",
        e.employment_status,
        e.joined_on,
      ]);
      return csvResponse(
        "karyawan.csv",
        toCsv(
          [
            "employee_no",
            "full_name",
            "work_email",
            "department",
            "position",
            "employment_status",
            "joined_on",
          ],
          rows,
        ),
      );
    }

    if (kind === "attendance") {
      const data = await exportRows((from, to) =>
        supabase
          .from("attendances")
          .select("employee_id, work_date, check_in_at, check_out_at, status", {
            count: "exact",
          })
          .eq("work_date", date)
          .order("employee_id", { ascending: true })
          .order("id")
          .range(from, to),
      );
      const rows = (data ?? []).map((a) => [
        a.employee_id,
        a.work_date,
        a.check_in_at,
        a.check_out_at,
        a.status,
      ]);
      return csvResponse(
        "absensi.csv",
        toCsv(
          ["employee_id", "work_date", "check_in_at", "check_out_at", "status"],
          rows,
        ),
      );
    }

    if (kind === "leave") {
      const data = await exportRows((from, to) =>
        supabase
          .from("leave_requests")
          .select(
            "employee_id, type, start_date, end_date, working_days, status, reason",
            { count: "exact" },
          )
          .order("start_date", { ascending: false })
          .order("id")
          .range(from, to),
      );
      const rows = (data ?? []).map((l) => [
        l.employee_id,
        l.type,
        l.start_date,
        l.end_date,
        l.working_days,
        l.status,
        l.reason,
      ]);
      return csvResponse(
        "cuti.csv",
        toCsv(
          [
            "employee_id",
            "type",
            "start_date",
            "end_date",
            "working_days",
            "status",
            "reason",
          ],
          rows,
        ),
      );
    }

    if (kind === "performance") {
      if (!period) throw api.invalidQuery("period wajib untuk laporan kinerja");
      const data = await exportRows((from, to) =>
        supabase
          .from("performance_reviews")
          .select("employee_id, period, score, notes, assessed_at", {
            count: "exact",
          })
          .eq("period", period)
          .order("employee_id", { ascending: true })
          .order("id")
          .range(from, to),
      );
      const rows = (data ?? []).map((r) => [
        r.employee_id,
        r.period,
        r.score,
        r.notes,
        r.assessed_at,
      ]);
      return csvResponse(
        "kinerja.csv",
        toCsv(["employee_id", "period", "score", "notes", "assessed_at"], rows),
      );
    }

    // payroll
    if (!period) throw api.invalidQuery("period wajib untuk laporan payroll");
    const data = await exportRows((from, to) =>
      supabase
        .from("payroll_items")
        .select(
          "employee_no, full_name, department_name, position_name, base_salary_idr, allowance_idr, bonus_idr, deduction_idr, net_salary_idr, status, payroll_runs!inner(period, status)",
          { count: "exact" },
        )
        .eq("payroll_runs.period", period)
        .order("employee_no", { ascending: true })
        .order("id")
        .range(from, to),
    );
    const rows = (data as unknown as Record<string, unknown>[])
      .filter((r) => {
        const run = r.payroll_runs as { period?: string } | null;
        return run?.period === period;
      })
      .map((r) => [
        r.employee_no,
        r.full_name,
        r.department_name,
        r.position_name,
        r.base_salary_idr,
        r.allowance_idr,
        r.bonus_idr,
        r.deduction_idr,
        r.net_salary_idr,
        r.status,
      ]);
    return csvResponse(
      `payroll-${period}.csv`,
      toCsv(
        [
          "employee_no",
          "full_name",
          "department",
          "position",
          "base_salary_idr",
          "allowance_idr",
          "bonus_idr",
          "deduction_idr",
          "net_salary_idr",
          "status",
        ],
        rows,
      ),
    );
  });
}
