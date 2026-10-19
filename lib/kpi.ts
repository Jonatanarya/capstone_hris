export type KpiIndicator = {
  name: string;
  unit: string;
  direction: "HIGHER" | "LOWER";
  target: number;
  weight: number;
  actual: number | null;
  measurement?: string;
  evidence?: string;
};
export type KpiDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  indicators: KpiIndicator[];
  notes: string;
  status: "DRAFT" | "PUBLISHED";
  score: number | null;
  version: number;
  publishedAt: string | null;
  goalsSharedAt?: string | null;
};
export type KpiGoalDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  indicators: Omit<KpiIndicator, "actual" | "evidence">[];
  sharedAt: string;
};

export function validateIndicators(value: unknown): value is KpiIndicator[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10)
    return false;
  const names = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    if (
      Object.keys(item).some(
        (k) =>
          ![
            "name",
            "unit",
            "direction",
            "target",
            "weight",
            "actual",
            "measurement",
            "evidence",
          ].includes(k),
      )
    )
      return false;
    for (const field of ["measurement", "evidence"])
      if (
        field in item &&
        (typeof item[field] !== "string" || item[field].length > 1000)
      )
        return false;
    if (
      typeof item.name !== "string" ||
      !item.name.trim() ||
      item.name.length > 120 ||
      typeof item.unit !== "string" ||
      !item.unit.trim() ||
      item.unit.length > 30 ||
      !["HIGHER", "LOWER"].includes(item.direction) ||
      typeof item.target !== "number" ||
      !Number.isFinite(item.target) ||
      item.target <= 0 ||
      item.target > 1e9 ||
      typeof item.weight !== "number" ||
      !Number.isInteger(item.weight) ||
      item.weight < 1 ||
      item.weight > 100 ||
      (item.actual !== null &&
        (typeof item.actual !== "number" ||
          !Number.isFinite(item.actual) ||
          item.actual < 0 ||
          item.actual > 1e9))
    )
      return false;
    const name = item.name.trim().toLowerCase();
    if (names.has(name)) return false;
    names.add(name);
  }
  return value.reduce((sum, item) => sum + item.weight, 0) === 100;
}
export function indicatorScore(item: KpiIndicator): number | null {
  if (item.actual === null) return null;
  return Math.min(
    100,
    item.direction === "HIGHER"
      ? (item.actual / item.target) * 100
      : item.actual === 0
        ? 100
        : (item.target / item.actual) * 100,
  );
}
export function kpiScore(items: KpiIndicator[]): number | null {
  if (!validateIndicators(items) || items.some((i) => i.actual === null))
    return null;
  return Math.round(
    items.reduce(
      (sum, item) => sum + (indicatorScore(item)! * item.weight) / 100,
      0,
    ),
  );
}
// A shared note is shown once. Distinct legacy evidence must remain distinct.
export function commonKpiEvidence(items: KpiIndicator[]): string | null {
  const first = items[0]?.evidence ?? "";
  return items.every((item) => (item.evidence ?? "") === first) ? first : null;
}
// Drafts may be incomplete. These reasons gate publishing, not draft saves.
export function kpiPublishIssues(
  items: KpiIndicator[],
  sharedEvidence = false,
): string[] {
  if (!validateIndicators(items))
    return ["Periksa indikator dan realisasi. Total bobot wajib tepat 100%."];
  const actuals = items.flatMap((item, i) =>
    item.actual === null ? [i + 1] : [],
  );
  const evidence = items.flatMap((item, i) =>
    !item.evidence?.trim() ? [i + 1] : [],
  );
  return [
    ...(actuals.length
      ? [`Isi realisasi indikator ${actuals.join(", ")}.`]
      : []),
    ...(evidence.length
      ? [
          sharedEvidence
            ? "Isi satu catatan bukti untuk seluruh indikator."
            : `Lengkapi bukti realisasi indikator ${evidence.join(", ")}.`,
        ]
      : []),
  ];
}
export function kpiRating(score: number): string {
  return score >= 90
    ? "Sangat baik"
    : score >= 75
      ? "Baik"
      : score >= 60
        ? "Cukup"
        : "Perlu peningkatan";
}
export const kpiTemplate = (): KpiIndicator[] => [
  {
    name: "Penyelesaian tugas",
    unit: "%",
    direction: "HIGHER",
    target: 100,
    weight: 50,
    actual: null,
    measurement:
      "Jumlah tugas selesai / tugas yang disepakati × 100. Sumber: daftar tugas bulanan.",
    evidence: "",
  },
  {
    name: "Kualitas hasil kerja",
    unit: "%",
    direction: "HIGHER",
    target: 100,
    weight: 30,
    actual: null,
    measurement:
      "Jumlah hasil diterima tanpa revisi / seluruh hasil diperiksa × 100. Sumber: catatan pemeriksaan.",
    evidence: "",
  },
  {
    name: "Ketepatan waktu",
    unit: "%",
    direction: "HIGHER",
    target: 100,
    weight: 20,
    actual: null,
    measurement:
      "Jumlah tugas selesai sebelum tenggat / tugas jatuh tempo × 100. Sumber: tenggat dan tanggal penyelesaian.",
    evidence: "",
  },
];
