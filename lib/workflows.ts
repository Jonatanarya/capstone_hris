import type { HrPolicy } from "./api-client";

export function isWorkingDate(date: string, policy: HrPolicy) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  return (
    policy.workingDays.includes(day) && !policy.holidayDates.includes(date)
  );
}
export function offsetDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function attendanceLabel(
  record: { checkIn: string; status?: string } | undefined,
  employeeStatus: string,
  leaveType: string | undefined,
  workingDay: boolean,
  live: boolean,
) {
  // The server status preserves seconds and the historical policy snapshot.
  if (record?.checkIn)
    return (live ? record.status === "LATE" : record.checkIn > "08:00")
      ? "Terlambat"
      : "Hadir";
  if (employeeStatus !== "Aktif") return "Nonaktif";
  if (!workingDay) return "Hari libur";
  if (leaveType) return leaveType;
  return "Belum absen";
}
