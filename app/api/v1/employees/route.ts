import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { api, created, handle, listOk, readJson } from "@/lib/api/http";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { EMPLOYEE_SELECT } from "@/lib/api/me";
import { employeeAdmin, employeeSummary, type EmployeeRow } from "@/lib/api/dto";
import { pagination, requireEnum } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";

const STATUSES = ["ACTIVE", "INACTIVE"] as const;

function safeTerm(q: string) {
  return q.replace(/[,()%]/g, " ").trim();
}

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR", "MANAGER");

    const { url, page, pageSize, q, from, to } = pagination(request);
    const departmentId = url.searchParams.get("departmentId");
    const employmentStatus = requireEnum(
      url.searchParams.get("employmentStatus"),
      STATUSES,
      "employmentStatus",
    );
    const order = url.searchParams.get("order") === "desc" ? false : true;

    let query = supabase
      .from("employees")
      .select(EMPLOYEE_SELECT, { count: "exact" })
      .order("full_name", { ascending: order })
      .order("id", { ascending: true })
      .range(from, to);

    if (q) {
      const term = safeTerm(q);
      if (term) {
        query = query.or(
          `full_name.ilike.%${term}%,employee_no.ilike.%${term}%,work_email.ilike.%${term}%`,
        );
      }
    }
    if (departmentId) query = query.eq("department_id", departmentId);
    if (employmentStatus) query = query.eq("employment_status", employmentStatus);

    const { data, error, count } = await query;
    if (error) throw toApiError(error);

    return listOk(
      (data as unknown as EmployeeRow[]).map(employeeSummary),
      page,
      pageSize,
      count ?? 0,
    );
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR");

    const body = (await readJson(request)) as Record<string, unknown>;
    const required = [
      "employeeNo", "fullName", "workEmail", "departmentId", "positionId",
      "employmentStatus", "joinedOn", "phone", "address", "baseSalaryIdr",
    ];
    const fieldErrors: Record<string, string[]> = {};
    for (const key of Object.keys(body)) {
      if (!required.includes(key)) fieldErrors[key] = ["Field tidak dikenal"];
    }
    for (const key of required) {
      if (body[key] === undefined || body[key] === null || body[key] === "") {
        fieldErrors[key] = ["Wajib diisi"];
      }
    }
    if (!STATUSES.includes(body.employmentStatus as (typeof STATUSES)[number])) {
      fieldErrors.employmentStatus = ["Nilai tidak dikenal"];
    }
    const salary = Number(body.baseSalaryIdr);
    if (!Number.isSafeInteger(salary) || salary < 0 || salary > 1_000_000_000_000) {
      fieldErrors.baseSalaryIdr = ["Integer 0–1.000.000.000.000"];
    }
    if (Object.keys(fieldErrors).length) throw api.validation(fieldErrors);

    const { error } = await supabase.rpc("create_employee", {
      p_employee_no: String(body.employeeNo).trim(),
      p_full_name: String(body.fullName).trim(),
      p_work_email: String(body.workEmail).trim(),
      p_department_id: body.departmentId,
      p_position_id: body.positionId,
      p_employment_status: body.employmentStatus,
      p_joined_on: body.joinedOn,
      p_phone: String(body.phone).trim(),
      p_address: String(body.address).trim(),
      p_base_salary_idr: salary,
    });
    if (error) throw toApiError(error);

    // Ambil kembali sebagai EmployeeAdmin (kompensasi via service role).
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("employees")
      .select(EMPLOYEE_SELECT)
      .eq("work_email", String(body.workEmail).trim().toLowerCase())
      .maybeSingle<EmployeeRow>();
    if (!data) throw api.notFound();

    return created(
      employeeAdmin(data, null, salary),
    );
  });
}