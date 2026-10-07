import type {
  AccountDto,
  AttendanceDto,
  EmployeeDto,
  LeaveDto,
  MasterDto,
  PayrollItemDto,
  PayrollRunDto,
  ReviewDto,
} from "./api-adapters";

/**
 * Klien API browser untuk `/api/v1`. Semua request same-origin + cookie session.
 * Frontend tetap memakai data demo bila backend belum dikonfigurasi; adapter ini
 * dipakai saat mode terintegrasi diaktifkan.
 */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type Envelope<T> = { data: T; meta: Record<string, unknown> };

async function requestEnvelope<T>(
  path: string,
  init?: RequestInit,
  extraHeaders?: HeadersInit,
): Promise<Envelope<T>> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-HRIS-Request": "1",
      ...(extraHeaders ?? {}),
      ...(init?.headers ?? {}),
    },
  });

  const json = (await response.json().catch(() => null)) as
    | (Envelope<T> & {
        error?: {
          code: string;
          message: string;
          fieldErrors?: Record<string, string[]>;
        };
      })
    | null;

  if (!response.ok || !json || json.error) {
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      path !== "/me" &&
      path !== "/auth/login"
    ) {
      window.dispatchEvent(new Event("hris-session-expired"));
    }
    throw new ApiClientError(
      response.status,
      json?.error?.code ?? "INTERNAL_ERROR",
      json?.error?.message ?? "Terjadi kesalahan pada server",
      json?.error?.fieldErrors,
    );
  }
  return json;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  extraHeaders?: HeadersInit,
): Promise<T> {
  return (await requestEnvelope<T>(path, init, extraHeaders)).data;
}

/** UI lists must not silently stop at the default first 20/100 rows. */
async function list<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  if (params.page !== undefined) return request<T[]>(`${path}${query(params)}`);
  const rows: T[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await requestEnvelope<T[]>(
      `${path}${query({ ...params, page, pageSize: 100 })}`,
    );
    if (Number(response.meta.total ?? 0) > 10000)
      throw new ApiClientError(
        422,
        "VALIDATION_ERROR",
        "Data melebihi batas tampilan. Gunakan filter.",
      );
    rows.push(...response.data);
    if (page >= Number(response.meta.totalPages ?? 1)) return rows;
  }
  throw new ApiClientError(
    422,
    "VALIDATION_ERROR",
    "Data melebihi batas tampilan. Gunakan filter.",
  );
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export type Me = {
  userId: string;
  role: "ADMIN_HR" | "MANAGER" | "EMPLOYEE";
  accountStatus: string;
  employee: {
    id: string;
    employeeNo: string;
    fullName: string;
    workEmail: string;
    department: { id: string; name: string } | null;
    position: { id: string; name: string } | null;
    employmentStatus: string;
    joinedOn: string;
    version: number;
    contact: { phone: string; address: string; version: number } | null;
  };
};

export type DashboardDto = {
  employeeCount: number;
  activeEmployeeCount: number;
  presentCount: number;
  pendingLeaveCount: number;
  averageReviewScore: number | null;
  reviewedEmployeeCount: number;
};

export const hrApi = {
  login: (identifier: string, password: string) =>
    request<Me>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),
  logout: () =>
    request<{ signedOut: boolean }>("/auth/logout", { method: "POST" }),
  resetPassword: (email: string) =>
    request("/auth/password-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  recoverPassword: (password: string) =>
    request("/auth/recover", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  me: () => request<Me>("/me"),
  updateContact: (phone: string, address: string, expectedVersion: number) =>
    request("/me/contact", {
      method: "PATCH",
      body: JSON.stringify({ phone, address, expectedVersion }),
    }),
  leaveBalance: (year: number) =>
    request<{ availableDays: number }>(`/me/leave-balance${query({ year })}`),
  dashboard: (period?: string) =>
    request<DashboardDto>(`/dashboard${query({ period })}`),
  employees: (
    params: {
      q?: string;
      departmentId?: string;
      employmentStatus?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) => list<EmployeeDto>("/employees", params),
  employee: (id: string) => request<EmployeeDto>(`/employees/${id}`),
  createEmployee: (body: Record<string, unknown>) =>
    request<EmployeeDto>("/employees", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateEmployee: (id: string, body: Record<string, unknown>) =>
    request<EmployeeDto>(`/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  departments: (
    params: { q?: string; page?: number; pageSize?: number } = {},
  ) => list<MasterDto>("/departments", params),
  createDepartment: (name: string) =>
    request<MasterDto>("/departments", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  renameDepartment: (id: string, name: string, expectedVersion: number) =>
    request<MasterDto>(`/departments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name, expectedVersion }),
    }),
  positions: (params: { q?: string; page?: number; pageSize?: number } = {}) =>
    list<MasterDto>("/positions", params),
  createPosition: (name: string) =>
    request<MasterDto>("/positions", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  renamePosition: (id: string, name: string, expectedVersion: number) =>
    request<MasterDto>(`/positions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name, expectedVersion }),
    }),
  attendance: (date?: string) => list<AttendanceDto>("/attendance", { date }),
  checkIn: () => request("/attendance/check-in", { method: "POST" }),
  checkOut: () => request("/attendance/check-out", { method: "POST" }),
  leaveRequests: (
    params: {
      status?: string;
      year?: number;
      page?: number;
      pageSize?: number;
    } = {},
  ) => list<LeaveDto>("/leave-requests", params),
  createLeaveRequest: (body: Record<string, unknown>) =>
    request<LeaveDto>("/leave-requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  decideLeaveRequest: (id: string, body: Record<string, unknown>) =>
    request<LeaveDto>(`/leave-requests/${id}/decision`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  payrollRuns: (period?: string) =>
    list<PayrollRunDto>("/payroll-runs", { period }),
  createPayrollRun: (period: string) =>
    request<PayrollRunDto>("/payroll-runs", {
      method: "POST",
      body: JSON.stringify({ period }),
    }),
  payrollItems: (runId: string) =>
    list<PayrollItemDto>(`/payroll-runs/${runId}/items`),
  updatePayrollItem: (id: string, body: Record<string, unknown>) =>
    request<PayrollItemDto>(`/payroll-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  publishPayrollRun: (runId: string, expectedVersion: number) =>
    request<PayrollRunDto>(`/payroll-runs/${runId}/publish`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
    }),
  payslip: (id: string) => request(`/payroll-items/${id}/payslip`),
  performanceReviews: (period: string) =>
    list<ReviewDto>("/performance-reviews", { period }),
  upsertReview: (
    employeeId: string,
    period: string,
    body: Record<string, unknown>,
  ) =>
    request<ReviewDto>(
      `/employees/${employeeId}/performance-reviews/${period}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    ),
  accounts: () => list<AccountDto>("/accounts"),
  inviteAccount: (employeeId: string, role: string, idempotencyKey: string) =>
    request(
      "/accounts/invite",
      { method: "POST", body: JSON.stringify({ employeeId, role }) },
      { "Idempotency-Key": idempotencyKey },
    ),
  updateAccount: (userId: string, body: Record<string, unknown>) =>
    request(`/accounts/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  reportUrl: (
    kind: string,
    params: Record<string, string | number | undefined> = {},
  ) => `/api/v1/reports/${kind}${query(params)}`,
};
