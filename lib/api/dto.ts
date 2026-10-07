/** Pemetaan baris DB (snake_case) → DTO kontrak (camelCase). */

export type EmployeeRow = {
  id: string;
  employee_no: string;
  full_name: string;
  work_email: string;
  employment_status: string;
  joined_on: string;
  version: number;
  departments: { id: string; name: string } | null;
  positions: { id: string; name: string } | null;
};

export function employeeSummary(e: EmployeeRow) {
  return {
    id: e.id,
    employeeNo: e.employee_no,
    fullName: e.full_name,
    workEmail: e.work_email,
    department: e.departments
      ? { id: e.departments.id, name: e.departments.name }
      : null,
    position: e.positions
      ? { id: e.positions.id, name: e.positions.name }
      : null,
    employmentStatus: e.employment_status,
    joinedOn: e.joined_on,
    version: e.version,
  };
}

export type ContactRow = {
  phone: string;
  address: string;
  version: number;
} | null;

export function employeeProfile(e: EmployeeRow, contact: ContactRow) {
  return {
    ...employeeSummary(e),
    contact: contact
      ? {
          phone: contact.phone,
          address: contact.address,
          version: contact.version,
        }
      : null,
  };
}

export function employeeAdmin(
  e: EmployeeRow,
  contact: ContactRow,
  baseSalaryIdr: number | null,
) {
  return {
    ...employeeProfile(e, contact),
    compensation: { baseSalaryIdr: baseSalaryIdr ?? 0 },
  };
}

export function masterDto(row: {
  id: string;
  name: string;
  status: string;
  version: number;
}) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    version: row.version,
  };
}

export type LeaveRow = {
  id: string;
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string;
  status: string;
  submitted_at: string;
  decided_by: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  version: number;
};

export function leaveDto(l: LeaveRow) {
  return {
    id: l.id,
    employeeId: l.employee_id,
    type: l.type,
    startDate: l.start_date,
    endDate: l.end_date,
    workingDays: l.working_days,
    reason: l.reason,
    status: l.status,
    submittedAt: l.submitted_at,
    decidedBy: l.decided_by,
    decidedAt: l.decided_at,
    rejectionReason: l.rejection_reason,
    version: l.version,
  };
}

export function isUuid(value: string | undefined | null): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    ),
  );
}
