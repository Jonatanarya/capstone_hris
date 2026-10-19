export type MonthlyReportRow = {
  employeeId: string;
  employeeNo: string;
  name: string;
  department: string;
  employmentStatus: string;
  period: string;
  workDays: number;
  presentDays: number;
  lateDays: number;
  annualLeaveDays: number;
  permissionDays: number;
  sickDays: number;
  absenceDays: number;
  incompleteDays: number;
  pendingCorrections: number;
  score: number | null;
  scoreSource: "KPI" | "LEGACY" | null;
  kpiStatus: "FINAL" | "IN_REVIEW" | "NO_TARGET";
};
export type Applicant = {
  id: string;
  full_name: string;
  position_name: string;
  applied_on: string;
  aptitude_score: number;
  technical_score: number;
  interview_score: number;
  notes: string;
  is_dummy: true;
  version: number;
};
export const applicantScore = (
  a: Pick<Applicant, "aptitude_score" | "technical_score" | "interview_score">,
) => Math.round((a.aptitude_score + a.technical_score + a.interview_score) / 3);
export const validTestScore = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 100;
export function monthlySummary(rows: MonthlyReportRow[]) {
  const scored = rows.filter((r) => r.score !== null);
  return {
    count: rows.length,
    scored: scored.length,
    average: scored.length
      ? Math.round(scored.reduce((s, r) => s + r.score!, 0) / scored.length)
      : null,
    pendingCorrections: rows.reduce((s, r) => s + r.pendingCorrections, 0),
  };
}
export const monthlyHeaders = [
  "Nomor Induk Karyawan",
  "Nama",
  "Departemen",
  "Periode",
  "Hari kerja berjalan",
  "Hadir (termasuk terlambat)",
  "Terlambat",
  "Cuti",
  "Izin",
  "Sakit",
  "Tanpa keterangan",
  "Belum absen keluar",
  "Koreksi menunggu",
  "Nilai",
  "Sumber nilai",
  "Status KPI",
];
export const monthlyCells = (r: MonthlyReportRow): unknown[] => [
  r.employeeNo,
  r.name,
  r.department,
  r.period,
  r.workDays,
  r.presentDays,
  r.lateDays,
  r.annualLeaveDays,
  r.permissionDays,
  r.sickDays,
  r.absenceDays,
  r.incompleteDays,
  r.pendingCorrections,
  r.score ?? "Belum dinilai",
  r.scoreSource ?? "",
  r.kpiStatus,
];
