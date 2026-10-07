import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "./http";
import { employeeProfile, type ContactRow, type EmployeeRow } from "./dto";
import type { Actor } from "./actor";

type MeRow = EmployeeRow & {
  employee_contacts: ContactRow | ContactRow[] | null;
};

/** Bangun DTO Me (userId, role, accountStatus, employee profile sendiri). */
export async function buildMe(supabase: SupabaseClient, actor: Actor) {
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, employee_no, full_name, work_email, employment_status, joined_on, version, " +
        "departments(id, name), positions(id, name), employee_contacts(phone, address, version)",
    )
    .eq("id", actor.employeeId)
    .maybeSingle<MeRow>();

  if (error || !data) throw api.forbidden("Profil karyawan tidak ditemukan");

  const contact = Array.isArray(data.employee_contacts)
    ? (data.employee_contacts[0] ?? null)
    : data.employee_contacts;

  return {
    userId: actor.userId,
    role: actor.role,
    accountStatus: actor.accountStatus,
    employee: employeeProfile(data, contact),
  };
}

export const EMPLOYEE_SELECT =
  "id, employee_no, full_name, work_email, employment_status, joined_on, version, " +
  "departments(id, name), positions(id, name)";
