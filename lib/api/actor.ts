import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, api } from "./http";

export type BusinessRole = "ADMIN_HR" | "MANAGER" | "EMPLOYEE";
export type AccountStatus = "INVITED" | "ACTIVE" | "DISABLED";

export type Actor = {
  userId: string;
  role: BusinessRole;
  accountStatus: AccountStatus;
  employeeId: string;
  departmentId: string;
  employeeStatus: "ACTIVE" | "INACTIVE";
};

type ProfileRow = {
  user_id: string;
  employee_id: string;
  role: BusinessRole;
  account_status: AccountStatus;
  employees: { department_id: string; employment_status: "ACTIVE" | "INACTIVE" } | null;
};

/**
 * Verifikasi identitas dari JWT (bukan dari body/role request) lalu baca
 * role/status terkini dari DB. Bukan memakai getSession() saja.
 */
export async function getActor(supabase: SupabaseClient): Promise<Actor> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw api.unauthenticated();

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "user_id, employee_id, role, account_status, employees(department_id, employment_status)",
    )
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  if (error) throw api.unauthenticated();
  if (!data) throw api.forbidden("Akun tidak terhubung ke profil karyawan");

  const employee = data.employees;
  return {
    userId: data.user_id,
    role: data.role,
    accountStatus: data.account_status,
    employeeId: data.employee_id,
    departmentId: employee?.department_id ?? "",
    employeeStatus: employee?.employment_status ?? "INACTIVE",
  };
}

/** Pastikan akun + karyawan aktif; lempar 403 bila tidak. */
export function assertActive(actor: Actor) {
  if (actor.accountStatus !== "ACTIVE") {
    throw new ApiError(
      403,
      actor.accountStatus === "DISABLED" ? "ACCOUNT_DISABLED" : "ACCOUNT_NOT_ACTIVE",
      "Akun tidak aktif",
    );
  }
  if (actor.employeeStatus !== "ACTIVE") {
    throw new ApiError(403, "EMPLOYEE_INACTIVE", "Karyawan tidak aktif");
  }
}

export function requireRole(actor: Actor, ...roles: BusinessRole[]) {
  if (!roles.includes(actor.role)) throw api.forbidden();
}

export function isHr(actor: Actor) {
  return actor.role === "ADMIN_HR";
}
export function isManager(actor: Actor) {
  return actor.role === "MANAGER";
}