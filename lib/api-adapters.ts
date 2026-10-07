/**
 * Adapter DTO kontrak Supabase → bentuk data yang dipakai UI (`app/hris-app.tsx`).
 * Menjembatani perbedaan penamaan: UUID vs bentuk UI, `employmentStatus`
 * (ACTIVE/INACTIVE) vs label UI ("Aktif"/"Nonaktif"), dan role backend
 * (ADMIN_HR/MANAGER/EMPLOYEE) vs label UI ("Admin HR"/"Manager"/"Karyawan").
 */
import type { Me } from "./api-client";

/** Bentuk karyawan yang dipakai state UI. `id` = UUID pada mode terintegrasi. */
export type UiPerson = {
  id: string;
  name: string;
  email: string;
  dept: string;
  position: string;
  status: string;
  salary: number;
  score: number;
  employeeNo: string;
  phone: string;
  address: string;
  joinDate: string;
};

export type UiRole = "Admin HR" | "Manager" | "Karyawan";
export type BackendRole = "ADMIN_HR" | "MANAGER" | "EMPLOYEE";

export type EmployeeSummaryDto = {
  id: string;
  employeeNo: string;
  fullName: string;
  workEmail: string;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  employmentStatus: string;
  joinedOn: string;
  version: number;
  contact?: { phone: string; address: string; version: number } | null;
  compensation?: { baseSalaryIdr: number } | null;
};

export function uiStatus(employmentStatus: string) {
  return employmentStatus === "ACTIVE" ? "Aktif" : "Nonaktif";
}

export function uiRole(role: BackendRole): UiRole {
  return role === "ADMIN_HR"
    ? "Admin HR"
    : role === "MANAGER"
      ? "Manager"
      : "Karyawan";
}

export function backendRole(role: UiRole): BackendRole {
  return role === "Admin HR"
    ? "ADMIN_HR"
    : role === "Manager"
      ? "MANAGER"
      : "EMPLOYEE";
}

/** Petakan satu karyawan DTO → UiPerson. Field yang tidak ada di DTO diberi default aman. */
export function personFromDto(e: EmployeeSummaryDto): UiPerson {
  return {
    id: e.id,
    name: e.fullName,
    email: e.workEmail,
    dept: e.department?.name ?? "Tanpa departemen",
    position: e.position?.name ?? "",
    status: uiStatus(e.employmentStatus),
    salary: e.compensation?.baseSalaryIdr ?? 0,
    score: 0,
    employeeNo: e.employeeNo,
    phone: e.contact?.phone ?? "",
    address: e.contact?.address ?? "",
    joinDate: e.joinedOn,
  };
}

/** Petakan `/me` → UiPerson (profil pengguna yang sedang login). */
export function personFromMe(me: Me): UiPerson {
  return personFromDto({
    id: me.employee.id,
    employeeNo: me.employee.employeeNo,
    fullName: me.employee.fullName,
    workEmail: me.employee.workEmail,
    department: me.employee.department,
    position: me.employee.position,
    employmentStatus: me.employee.employmentStatus,
    joinedOn: me.employee.joinedOn,
    version: me.employee.version,
    contact: me.employee.contact,
  });
}

/** Bulan UI ("September 2026") ⇄ periode API ("2026-09"). */
const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function periodFromLabel(label: string) {
  const [month, year] = label.split(" ");
  const index = MONTHS_ID.indexOf(month);
  if (index < 0 || !/^\d{4}$/.test(year ?? "")) return "";
  return `${year}-${String(index + 1).padStart(2, "0")}`;
}

export function labelFromPeriod(period: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  return `${MONTHS_ID[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** Jenis cuti: DTO (ANNUAL/PERMISSION/SICK) ⇄ label UI. */
const LEAVE_TYPES: Record<string, string> = {
  ANNUAL: "Cuti tahunan",
  PERMISSION: "Izin",
  SICK: "Sakit",
};
export function leaveTypeLabel(type: string) {
  return LEAVE_TYPES[type] ?? type;
}
export function leaveTypeCode(label: string) {
  const found = Object.entries(LEAVE_TYPES).find(([, v]) => v === label);
  return found?.[0] ?? "ANNUAL";
}

/** Status cuti: DTO (PENDING/APPROVED/REJECTED) ⇄ label UI. */
const LEAVE_STATUS: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};
export function leaveStatusLabel(status: string) {
  return LEAVE_STATUS[status] ?? status;
}
export function leaveStatusCode(label: string) {
  const found = Object.entries(LEAVE_STATUS).find(([, v]) => v === label);
  return found?.[0] ?? "PENDING";
}

export type LeaveDto = {
  id: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  submittedAt?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  rejectionReason?: string | null;
  version?: number;
};

export type UiLeave = {
  id: string;
  employee: string;
  type: string;
  start: string;
  end: string;
  reason: string;
  status: string;
  submittedAt?: string;
  approver?: string;
  decidedAt?: string;
  rejectionReason?: string;
  version?: number;
};

/** Petakan DTO cuti → bentuk Leave UI. `decidedBy` = userId; dipetakan oleh pemanggil. */
export function leaveFromDto(
  l: LeaveDto,
  decidedByName?: (userId: string | null) => string | undefined,
): UiLeave {
  return {
    id: l.id,
    employee: l.employeeId,
    type: leaveTypeLabel(l.type),
    start: l.startDate,
    end: l.endDate,
    reason: l.reason,
    status: leaveStatusLabel(l.status),
    submittedAt: l.submittedAt?.slice(0, 10),
    approver: decidedByName?.(l.decidedBy ?? null),
    decidedAt: l.decidedAt?.slice(0, 10),
    rejectionReason: l.rejectionReason ?? undefined,
    version: l.version,
  };
}

export type AttendanceDto = {
  id: string;
  employeeId: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
  version?: number;
};

export type UiAttendance = {
  employee: string;
  date: string;
  checkIn: string;
  checkOut: string;
};

/** Format timestamp UTC → "HH:MM" WIB. */
export function wibTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function attendanceFromDto(a: AttendanceDto): UiAttendance {
  return {
    employee: a.employeeId,
    date: a.workDate,
    checkIn: wibTime(a.checkInAt),
    checkOut: wibTime(a.checkOutAt),
  };
}

export type ReviewDto = {
  id: string;
  employeeId: string;
  employeeName?: string | null;
  period: string;
  score: number;
  notes: string;
  assessedAt: string;
  version?: number;
};

export type PayrollRunDto = {
  id: string;
  period: string;
  status: string;
  publishedAt: string | null;
  version: number;
};

export type PayrollItemDto = {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeNo: string;
  fullName: string;
  departmentName: string;
  positionName: string;
  baseSalaryIdr: number;
  allowanceIdr: number;
  bonusIdr: number;
  deductionIdr: number;
  netSalaryIdr: number;
  status: string;
  version: number;
};

export type PayrollReadinessDto = {
  status: "DRAFT" | "PUBLISHED";
  ready: boolean;
  missingSalaryCount: number;
  missingSalaryEmployees: {
    id: string;
    employeeNo: string;
    fullName: string;
  }[];
  missingItemCount: number;
  inactiveItemCount: number;
  staleItemCount: number;
  invalidDeductionCount: number;
  itemCount: number;
  activeEmployeeCount: number;
};

export type MasterDto = {
  id: string;
  name: string;
  status: string;
  version: number;
};

export type AccountDto = {
  userId: string;
  employeeId: string;
  employeeNo: string | null;
  fullName: string | null;
  workEmail: string | null;
  role: BackendRole;
  accountStatus: string;
  version: number;
};

export type { EmployeeSummaryDto as EmployeeDto };
