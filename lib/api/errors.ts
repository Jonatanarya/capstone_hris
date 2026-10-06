import { ApiError } from "./http";
import type { ApiErrorCode } from "./http";

/** Peta kode error Postgres/RPC (raise exception 'CODE') ke ApiError. */
const KNOWN: Record<string, { status: number; code: ApiErrorCode; message: string }> = {
  FORBIDDEN: { status: 403, code: "FORBIDDEN", message: "Aksi tidak diizinkan" },
  NOT_FOUND: { status: 404, code: "NOT_FOUND", message: "Data tidak ditemukan" },
  VALIDATION_ERROR: { status: 422, code: "VALIDATION_ERROR", message: "Data tidak valid" },
  VERSION_CONFLICT: { status: 409, code: "VERSION_CONFLICT", message: "Data telah berubah, muat ulang" },
  DUPLICATE_EMPLOYEE_NO: { status: 409, code: "DUPLICATE_EMPLOYEE_NO", message: "Nomor induk sudah dipakai" },
  DUPLICATE_EMAIL: { status: 409, code: "DUPLICATE_EMAIL", message: "Email sudah dipakai" },
  DUPLICATE_PERIOD: { status: 409, code: "DUPLICATE_PERIOD", message: "Periode payroll sudah ada" },
  ALREADY_CHECKED_IN: { status: 409, code: "ALREADY_CHECKED_IN", message: "Sudah absen masuk hari ini" },
  ALREADY_CHECKED_OUT: { status: 409, code: "ALREADY_CHECKED_OUT", message: "Sudah absen keluar hari ini" },
  CHECK_IN_REQUIRED: { status: 409, code: "CHECK_IN_REQUIRED", message: "Belum absen masuk hari ini" },
  LEAVE_OVERLAP: { status: 409, code: "LEAVE_OVERLAP", message: "Tanggal bentrok dengan pengajuan aktif" },
  LEAVE_BALANCE_EXCEEDED: { status: 409, code: "LEAVE_BALANCE_EXCEEDED", message: "Durasi melebihi sisa cuti" },
  LEAVE_ALREADY_DECIDED: { status: 409, code: "LEAVE_ALREADY_DECIDED", message: "Pengajuan sudah diputuskan" },
  PAYROLL_ALREADY_PUBLISHED: { status: 409, code: "PAYROLL_ALREADY_PUBLISHED", message: "Payroll sudah diterbitkan" },
  IDEMPOTENCY_CONFLICT: { status: 409, code: "IDEMPOTENCY_CONFLICT", message: "Kunci idempotensi bentrok" },
};

/** Terjemahkan error dari supabase-js/RPC menjadi ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);

  for (const key of Object.keys(KNOWN)) {
    if (raw.includes(key)) {
      const k = KNOWN[key];
      return new ApiError(k.status, k.code, k.message);
    }
  }
  if (raw.includes("duplicate key")) {
    return new ApiError(409, "DUPLICATE_NAME", "Data sudah ada");
  }
  console.error("UNMAPPED_DB_ERROR", raw);
  return new ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan pada server");
}