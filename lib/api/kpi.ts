import { api } from "./http";
import type { KpiDto, KpiIndicator } from "../kpi";
export function kpiPeriod(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value)
  )
    throw api.validation({
      period: ["Periode wajib YYYY-MM, tahun 2000–2100"],
    });
  return value;
}
export type KpiRow = {
  id: string;
  employee_id: string;
  period: string;
  indicators: KpiIndicator[];
  notes: string;
  status: "DRAFT" | "PUBLISHED";
  score: number | null;
  version: number;
  published_at: string | null;
  employees?: { full_name: string } | null;
};
export function kpiDto(row: KpiRow): KpiDto {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? "",
    period: row.period,
    indicators: row.indicators,
    notes: row.notes,
    status: row.status,
    score: row.score,
    version: row.version,
    publishedAt: row.published_at,
  };
}
