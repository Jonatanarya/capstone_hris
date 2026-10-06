export type PayrollItemRow = {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  employee_no: string;
  full_name: string;
  department_name: string;
  position_name: string;
  base_salary_idr: number;
  allowance_idr: number;
  bonus_idr: number;
  deduction_idr: number;
  net_salary_idr: number;
  status: string;
  version: number;
};

export function payrollItemDto(i: PayrollItemRow) {
  return {
    id: i.id,
    payrollRunId: i.payroll_run_id,
    employeeId: i.employee_id,
    employeeNo: i.employee_no,
    fullName: i.full_name,
    departmentName: i.department_name,
    positionName: i.position_name,
    baseSalaryIdr: i.base_salary_idr,
    allowanceIdr: i.allowance_idr,
    bonusIdr: i.bonus_idr,
    deductionIdr: i.deduction_idr,
    netSalaryIdr: i.net_salary_idr,
    status: i.status,
    version: i.version,
  };
}

export const PAYROLL_ITEM_SELECT =
  "id, payroll_run_id, employee_id, employee_no, full_name, department_name, " +
  "position_name, base_salary_idr, allowance_idr, bonus_idr, deduction_idr, " +
  "net_salary_idr, status, version";