import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, listOk } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";

type AccountRow = {
  user_id: string;
  employee_id: string;
  role: string;
  account_status: string;
  version: number;
  employees: {
    employee_no: string;
    full_name: string;
    work_email: string;
  } | null;
};

function accountDto(a: AccountRow) {
  return {
    userId: a.user_id,
    employeeId: a.employee_id,
    employeeNo: a.employees?.employee_no ?? null,
    fullName: a.employees?.full_name ?? null,
    workEmail: a.employees?.work_email ?? null,
    role: a.role,
    accountStatus: a.account_status,
    version: a.version,
  };
}

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "ADMIN_HR") throw api.forbidden();

    const { page, pageSize, from, to } = pagination(request);
    const { data, error, count } = await supabase
      .from("user_profiles")
      .select(
        "user_id, employee_id, role, account_status, version, " +
          "employees(employee_no, full_name, work_email)",
        { count: "exact" },
      )
      .order("created_at", { ascending: true })
      .range(from, to);
    if (error) throw toApiError(error);
    return listOk(
      (data as unknown as AccountRow[]).map(accountDto),
      page,
      pageSize,
      count ?? 0,
    );
  });
}
