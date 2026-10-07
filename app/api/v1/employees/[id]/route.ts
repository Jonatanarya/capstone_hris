import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import {
  employeeAdmin,
  employeeProfile,
  employeeSummary,
  isUuid,
  type ContactRow,
  type EmployeeRow,
} from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";

const SELECT =
  "id, employee_no, full_name, work_email, employment_status, joined_on, version, " +
  "departments(id, name), positions(id, name), employee_contacts(phone, address, version)";

type Row = EmployeeRow & {
  employee_contacts: ContactRow | ContactRow[] | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    if (!isUuid(id)) throw api.notFound();

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);

    const { data, error } = await supabase
      .from("employees")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle<Row>();
    if (error) throw toApiError(error);
    if (!data) throw api.notFound();

    const contact = Array.isArray(data.employee_contacts)
      ? (data.employee_contacts[0] ?? null)
      : data.employee_contacts;

    if (actor.role === "ADMIN_HR") {
      const { data: salary, error: salaryError } = await supabase.rpc(
        "employee_compensation_for_hr",
        { p_employee_id: id },
      );
      if (salaryError) throw toApiError(salaryError);
      if (salary === null)
        throw api.serviceUnavailable("Data kompensasi belum tersedia");
      return ok(employeeAdmin(data, contact, Number(salary)));
    }
    if (id === actor.employeeId) return ok(employeeProfile(data, contact));
    return ok(employeeSummary(data));
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    if (!isUuid(id)) throw api.notFound();

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "ADMIN_HR") throw api.forbidden();

    const body = (await readJson(request)) as Record<string, unknown>;
    const allowed = new Set([
      "fullName",
      "workEmail",
      "departmentId",
      "positionId",
      "employmentStatus",
      "joinedOn",
      "phone",
      "address",
      "baseSalaryIdr",
      "expectedVersion",
    ]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key))
        throw api.validation({ [key]: ["Field tidak dikenal"] });
    }
    const expectedVersion = Number(body.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw api.validation({ expectedVersion: ["Wajib integer >= 1"] });
    }
    if (body.workEmail !== undefined) {
      // Perubahan email akun terhubung tidak diizinkan pada v1.
      const { data: linked } = await supabase
        .from("user_profiles")
        .select("user_id")
        .eq("employee_id", id)
        .maybeSingle();
      if (linked) {
        throw api.validation({
          workEmail: ["Email akun terhubung belum dapat diubah"],
        });
      }
    }

    const { error } = await supabase.rpc("update_employee", {
      p_employee_id: id,
      p_expected_version: expectedVersion,
      p_full_name: body.fullName ?? null,
      p_work_email: body.workEmail ?? null,
      p_department_id: body.departmentId ?? null,
      p_position_id: body.positionId ?? null,
      p_employment_status: body.employmentStatus ?? null,
      p_joined_on: body.joinedOn ?? null,
      p_phone: body.phone ?? null,
      p_address: body.address ?? null,
      p_base_salary_idr: body.baseSalaryIdr ?? null,
    });
    if (error) throw toApiError(error);

    const { data, error: readError } = await supabase
      .from("employees")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle<Row>();
    if (readError) throw toApiError(readError);
    if (!data) throw api.notFound();
    const contact = Array.isArray(data.employee_contacts)
      ? (data.employee_contacts[0] ?? null)
      : data.employee_contacts;
    const { data: salary, error: salaryError } = await supabase.rpc(
      "employee_compensation_for_hr",
      { p_employee_id: id },
    );
    if (salaryError) throw toApiError(salaryError);
    if (salary === null)
      throw api.serviceUnavailable("Data kompensasi belum tersedia");
    return ok(employeeAdmin(data, contact, Number(salary)));
  });
}
