import { describe, expect, it } from "vitest";
import { payrollNet, salaryConfigured } from "../lib/payroll";
import { toApiError } from "../lib/api/errors";
describe("payroll draft correctness", () => {
  it("uses the payroll snapshot salary, not a directory summary default", () => {
    expect(payrollNet(9000000, 500000, 250000, 100000)).toBe(9650000);
  });
  it("allows a genuinely zero net after valid deductions", () => {
    expect(payrollNet(100, 0, 0, 100)).toBe(0);
  });
  it.each([
    [100, 0, 0, 101],
    [-1, 0, 0, 0],
    [1, 0.5, 0, 0],
    [NaN, 0, 0, 0],
    [100, 0, Infinity, 0],
    [1e12 + 1, 0, 0, 0],
  ])("rejects invalid components %#", (base, allowance, bonus, deduction) => {
    expect(payrollNet(base, allowance, bonus, deduction)).toBeNull();
  });
  it("zero is unconfigured, while a positive salary is configured", () => {
    expect(salaryConfigured(0)).toBe(false);
    expect(salaryConfigured(NaN)).toBe(false);
    expect(salaryConfigured(1234567)).toBe(true);
  });
  it("maps publication validation to an actionable 422", () => {
    expect(toApiError({ message: "PAYROLL_NOT_READY" })).toMatchObject({
      status: 422,
      code: "PAYROLL_NOT_READY",
    });
  });
});
