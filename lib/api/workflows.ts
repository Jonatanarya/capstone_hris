import { api } from "./http";

/** Shared strict input validation for demo workflow mutations. */
export function workflowBody(body: Record<string, unknown>, fields: string[]) {
  if (Object.keys(body).some((key) => !fields.includes(key)))
    throw api.validation({ body: ["Field tidak dikenal"] });
}
export function workflowVersion(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 2147483647
  )
    throw api.validation({ expectedVersion: ["Wajib integer positif"] });
  return value;
}
export function workflowDate(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw api.validation({ date: ["Tanggal tidak valid"] });
  return value;
}
export function workflowTime(value: unknown): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw api.validation({ time: ["Jam harus HH:MM"] });
  return value;
}
export function workflowText(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 2000)
    throw api.validation({ reason: ["Wajib 1–2000 karakter"] });
  return value.trim();
}

export type PolicyRow = {
  work_start: string;
  work_end: string;
  working_days: number[];
  holiday_dates: string[];
  default_entitlement: number;
  sick_backdate_days: number;
  policy_version: number;
};
export function policyDto(row: PolicyRow) {
  return {
    workStart: row.work_start.slice(0, 5),
    workEnd: row.work_end.slice(0, 5),
    workingDays: row.working_days,
    holidayDates: row.holiday_dates,
    defaultEntitlement: row.default_entitlement,
    sickBackdateDays: row.sick_backdate_days,
    version: row.policy_version,
  };
}
