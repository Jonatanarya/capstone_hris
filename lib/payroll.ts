/** One source of truth for form previews; never substitute directory salaries. */
export function payrollNet(
  baseSalary: number,
  allowance: number,
  bonus: number,
  deduction: number,
) {
  const values = [baseSalary, allowance, bonus, deduction];
  if (
    values.some(
      (value) => !Number.isSafeInteger(value) || value < 0 || value > 1e12,
    )
  )
    return null;
  const gross = baseSalary + allowance + bonus;
  return deduction <= gross ? gross - deduction : null;
}

export function salaryConfigured(value: number) {
  return Number.isSafeInteger(value) && value > 0 && value <= 1e12;
}
