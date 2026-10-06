/**
 * Envelope + error untuk API aplikasi `/api/v1` sesuai kontrak.
 * Sukses: { data, meta.requestId }. List juga punya page/pageSize/total/totalPages.
 * Error: { error: { code, message, fieldErrors? }, meta.requestId }.
 */
export type ApiErrorCode =
  | "INVALID_QUERY"
  | "INVALID_JSON"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "ACCOUNT_DISABLED"
  | "EMPLOYEE_INACTIVE"
  | "ACCOUNT_NOT_ACTIVE"
  | "NOT_FOUND"
  | "DUPLICATE_EMPLOYEE_NO"
  | "DUPLICATE_EMAIL"
  | "DUPLICATE_NAME"
  | "DUPLICATE_PERIOD"
  | "VERSION_CONFLICT"
  | "ALREADY_CHECKED_IN"
  | "ALREADY_CHECKED_OUT"
  | "CHECK_IN_REQUIRED"
  | "LEAVE_OVERLAP"
  | "LEAVE_BALANCE_EXCEEDED"
  | "LEAVE_ALREADY_DECIDED"
  | "PAYROLL_ALREADY_PUBLISHED"
  | "IDEMPOTENCY_CONFLICT"
  | "OPERATION_IN_PROGRESS"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

export function newRequestId() {
  return "req-" + crypto.randomUUID();
}

export function ok<T>(
  data: T,
  meta: Record<string, unknown> = {},
  init?: ResponseInit,
) {
  return Response.json(
    { data, meta: { requestId: newRequestId(), ...meta } },
    init,
  );
}

export function listOk<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
) {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return Response.json({
    data,
    meta: { requestId: newRequestId(), page, pageSize, total, totalPages },
  });
}

export function created<T>(data: T, meta: Record<string, unknown> = {}) {
  return ok(data, meta, { status: 201 });
}

export function fail(
  status: number,
  code: ApiErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  return Response.json(
    {
      error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
      meta: { requestId: newRequestId() },
    },
    { status },
  );
}

/** Error yang mewakili respons API siap-kirim. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
  toResponse() {
    return fail(this.status, this.code, this.message, this.fieldErrors);
  }
}

export const api = {
  invalidQuery: (message = "Parameter tidak dapat dibaca") =>
    new ApiError(400, "INVALID_QUERY", message),
  invalidJson: (message = "Body JSON tidak valid") =>
    new ApiError(400, "INVALID_JSON", message),
  unauthenticated: (message = "Sesi tidak ditemukan") =>
    new ApiError(401, "UNAUTHENTICATED", message),
  invalidCredentials: (message = "Email atau kata sandi salah") =>
    new ApiError(401, "INVALID_CREDENTIALS", message),
  forbidden: (message = "Aksi tidak diizinkan") =>
    new ApiError(403, "FORBIDDEN", message),
  notFound: (message = "Data tidak ditemukan") =>
    new ApiError(404, "NOT_FOUND", message),
  conflict: (code: ApiErrorCode, message: string) =>
    new ApiError(409, code, message),
  validation: (fieldErrors: Record<string, string[]>, message = "Data tidak valid") =>
    new ApiError(422, "VALIDATION_ERROR", message, fieldErrors),
  serviceUnavailable: (message = "Layanan tidak tersedia") =>
    new ApiError(503, "SERVICE_UNAVAILABLE", message),
};

/** Bungkus handler agar ApiError/exception menjadi envelope aman. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    console.error("API_INTERNAL_ERROR", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan pada server");
  }
}

/** Baca JSON body, tolak bila tidak valid. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw api.invalidJson();
  }
}