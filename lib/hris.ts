/** Demo policy, not legal entitlement. Backend must enforce these rules again. */
export type LeaveRequest = {
  employee: number;
  type: string;
  start: string;
  end: string;
  status: string;
};
export function jakartaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function workingDays(start: string, end: string) {
  if (!validDate(start) || !validDate(end) || end < start) return 0;
  let count = 0;
  for (
    let time = Date.parse(start);
    time <= Date.parse(end);
    time += 86400000
  ) {
    const day = new Date(time).getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}
export function availableLeave(
  leaves: LeaveRequest[],
  employee: number,
  year: string,
) {
  return Math.max(
    0,
    12 -
      leaves
        .filter(
          (l) =>
            l.employee === employee &&
            l.type === "Cuti tahunan" &&
            l.status !== "Ditolak",
        )
        .reduce((sum, l) => {
          const start = l.start < `${year}-01-01` ? `${year}-01-01` : l.start;
          const end = l.end > `${year}-12-31` ? `${year}-12-31` : l.end;
          return sum + workingDays(start, end);
        }, 0),
  );
}
export function leaveError(
  request: LeaveRequest,
  leaves: LeaveRequest[],
  today: string,
) {
  if (
    !validDate(request.start) ||
    !validDate(request.end) ||
    request.end < request.start
  )
    return "Tanggal pengajuan tidak valid";
  if (request.start < today)
    return "Pengajuan tidak boleh dimulai sebelum hari ini";
  if (request.start.slice(0, 4) !== request.end.slice(0, 4))
    return "Pisahkan pengajuan untuk tahun yang berbeda";
  if (!workingDays(request.start, request.end))
    return "Pilih minimal satu hari kerja (Senin–Jumat)";
  if (
    leaves.some(
      (l) =>
        l.employee === request.employee &&
        l.status !== "Ditolak" &&
        request.start <= l.end &&
        request.end >= l.start,
    )
  )
    return "Tanggal bentrok dengan pengajuan yang masih aktif";
  if (
    request.type === "Cuti tahunan" &&
    workingDays(request.start, request.end) >
      availableLeave(leaves, request.employee, request.start.slice(0, 4))
  )
    return "Durasi melebihi sisa cuti";
  return null;
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function payrollError(
  salary: number,
  allowance: number,
  bonus: number,
  deduction: number,
) {
  const values = [salary, allowance, bonus, deduction];
  return (
    values.some((v) => !Number.isFinite(v) || v < 0) ||
    deduction > salary + allowance + bonus
  );
}
