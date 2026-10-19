import { describe, it, expect } from "vitest";
import {
  applicantScore,
  validTestScore,
  monthlySummary,
  monthlyCells,
  monthlyHeaders,
  type MonthlyReportRow,
} from "../lib/lecturer-revision";
describe("revised reporting and simulated recruitment", () => {
  it("equally weights scores and rounds once", () => {
    expect(
      applicantScore({
        aptitude_score: 90,
        technical_score: 80,
        interview_score: 70,
      }),
    ).toBe(80);
    expect(
      applicantScore({
        aptitude_score: 0,
        technical_score: 0,
        interview_score: 1,
      }),
    ).toBe(0);
    expect(
      applicantScore({
        aptitude_score: 100,
        technical_score: 100,
        interview_score: 100,
      }),
    ).toBe(100);
  });
  it("allows zero but not fractional, missing or string scores", () => {
    expect(validTestScore(0)).toBe(true);
    expect(validTestScore(100)).toBe(true);
    for (const n of [-1, 101, 50.5, "90", null, NaN, Infinity])
      expect(validTestScore(n)).toBe(false);
  });
  it("unknown ratings are excluded from average, real zeros are included", () => {
    const rows = [null, 0, 100].map(
      (score) => ({ score, pendingCorrections: 1 }) as MonthlyReportRow,
    );
    expect(monthlySummary(rows)).toEqual({
      count: 3,
      scored: 2,
      average: 50,
      pendingCorrections: 3,
    });
    expect(monthlySummary([]).average).toBeNull();
  });
  it("export preserves zero and readable identities", () => {
    const row = {
      employeeNo: "EMP-001",
      name: "Contoh",
      score: 0,
    } as MonthlyReportRow;
    expect(monthlyCells(row)[0]).toBe("EMP-001");
    expect(monthlyCells(row)[13]).toBe(0);
    expect(monthlyCells({ ...row, score: null })[13]).toBe("Belum dinilai");
    expect(monthlyCells(row)).toHaveLength(monthlyHeaders.length);
  });
});
