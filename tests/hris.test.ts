import { describe, it, expect } from "vitest";
import {
  availableLeave,
  csvCell,
  jakartaDate,
  leaveError,
  payrollError,
  workingDays,
} from "../lib/hris";
const request = {
  employee: 2,
  type: "Cuti tahunan",
  start: "2026-10-05",
  end: "2026-10-06",
  status: "Menunggu",
};
describe("aturan demo HRIS", () => {
  it("menghitung hari kerja tanpa akhir pekan dan menolak tanggal tidak valid", () => {
    expect(workingDays("2026-10-02", "2026-10-05")).toBe(2);
    expect(workingDays("2026-02-30", "2026-03-02")).toBe(0);
    expect(workingDays("2026-10-06", "2026-10-05")).toBe(0);
  });
  it("memesan kuota pending; rejected dan tahun lain tidak mengurangi", () => {
    expect(availableLeave([request], 2, "2026")).toBe(10);
    expect(availableLeave([{ ...request, status: "Ditolak" }], 2, "2026")).toBe(
      12,
    );
    expect(availableLeave([request], 2, "2027")).toBe(12);
    expect(availableLeave([request], 3, "2026")).toBe(12);
  });
  it("menolak tanggal lampau, lintas tahun, akhir pekan, bentrok, dan kuota habis", () => {
    expect(leaveError(request, [], "2026-10-04")).toBeNull();
    expect(leaveError(request, [], "2026-10-07")).toMatch(/hari ini/);
    expect(
      leaveError(
        { ...request, start: "2026-12-31", end: "2027-01-01" },
        [],
        "2026-10-04",
      ),
    ).toMatch(/tahun/);
    expect(
      leaveError(
        { ...request, start: "2026-10-03", end: "2026-10-04" },
        [],
        "2026-10-01",
      ),
    ).toMatch(/hari kerja/);
    expect(leaveError(request, [request], "2026-10-04")).toMatch(/bentrok/);
    expect(
      leaveError({ ...request, end: "2026-10-30" }, [], "2026-10-04"),
    ).toMatch(/sisa cuti/);
  });
  it("memakai tanggal Jakarta saat UTC masih hari sebelumnya", () => {
    expect(jakartaDate(new Date("2026-10-03T18:00:00Z"))).toBe("2026-10-04");
  });
  it("melindungi CSV dari formula dan meng-escape kutipan", () => {
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
    expect(csvCell('Rizky, "QA"')).toBe('"Rizky, ""QA"""');
    expect(csvCell(" @formula")).toBe('"\' @formula"');
  });
  it("menolak komponen payroll negatif, NaN, dan potongan berlebih", () => {
    expect(payrollError(9000000, 500000, 250000, 0)).toBe(false);
    expect(payrollError(1, 0, 0, 2)).toBe(true);
    expect(payrollError(1, -1, 0, 0)).toBe(true);
    expect(payrollError(NaN, 0, 0, 0)).toBe(true);
  });
});
