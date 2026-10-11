import { describe, it, expect } from "vitest";
import {
  indicatorScore,
  kpiScore,
  kpiTemplate,
  kpiRating,
  validateIndicators,
} from "../lib/kpi";
import { kpiPeriod } from "../lib/api/kpi";
describe("KPI weighted calculations and strict validation", () => {
  it("does not turn blank actuals into zero or a fake final score", () => {
    const items = kpiTemplate();
    expect(validateIndicators(items)).toBe(true);
    expect(kpiScore(items)).toBeNull();
    expect(indicatorScore(items[0])).toBeNull();
  });
  it("computes a rounded weighted final score", () => {
    const items = kpiTemplate().map((i, n) => ({
      ...i,
      actual: [80, 90, 100][n],
    }));
    expect(kpiScore(items)).toBe(87);
  });
  it("caps above-target achievement and handles lower-is-better", () => {
    const items = [
      { ...kpiTemplate()[0], weight: 70, actual: 80 },
      {
        ...kpiTemplate()[1],
        name: "Errors",
        direction: "LOWER" as const,
        target: 2,
        weight: 30,
        actual: 4,
      },
    ];
    expect(kpiScore(items)).toBe(71);
    expect(indicatorScore({ ...items[1], actual: 0 })).toBe(100);
    expect(indicatorScore({ ...items[0], actual: 200 })).toBe(100);
    expect(indicatorScore({ ...items[0], actual: 0 })).toBe(0);
  });
  it.each([
    "bad weight",
    "zero target",
    "negative actual",
    "numeric string",
    "fractional weight",
    "duplicate",
    "extra score",
    "missing actual",
    "infinity",
    "null",
    "too many",
  ])("rejects %s", (kind) => {
    const items: unknown = kpiTemplate();
    const array = items as Record<string, unknown>[];
    if (kind === "bad weight") array[0].weight = 49;
    if (kind === "zero target") array[0].target = 0;
    if (kind === "negative actual") array[0].actual = -1;
    if (kind === "numeric string") array[0].actual = "80";
    if (kind === "fractional weight") array[0].weight = 49.5;
    if (kind === "duplicate") array[1].name = ` ${array[0].name} `;
    if (kind === "extra score") array[0].score = 100;
    if (kind === "missing actual") delete array[0].actual;
    if (kind === "infinity") array[0].actual = Infinity;
    if (kind === "null") array[0] = null as unknown as Record<string, unknown>;
    if (kind === "too many")
      array.push(...Array.from({ length: 9 }, () => array[0]));
    expect(validateIndicators(items)).toBe(false);
  });
  it("rejects non-array and non-object values", () => {
    for (const value of [null, {}, [], [1], ["name"]])
      expect(validateIndicators(value)).toBe(false);
  });
  it("labels demo ratings at exact boundaries", () => {
    expect([90, 75, 60, 59].map(kpiRating)).toEqual([
      "Sangat baik",
      "Baik",
      "Cukup",
      "Perlu peningkatan",
    ]);
  });
  it("strictly bounds period", () => {
    expect(kpiPeriod("2100-12")).toBe("2100-12");
    for (const value of ["1999-01", "2101-01", "2026-13", null])
      expect(() => kpiPeriod(value)).toThrow();
  });
});
