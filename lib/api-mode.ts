/**
 * Pilih sumber data UI: mode demo (in-memory seed) atau mode terintegrasi
 * (Supabase via `/api/v1`).
 *
 * Default = demo agar build/test/e2e tetap hijau tanpa backend. Aktifkan mode
 * terintegrasi secara eksplisit dengan `NEXT_PUBLIC_API_MODE=live` sehingga
 * kegagalan API tidak pernah disamarkan oleh data contoh.
 */
export type ApiMode = "demo" | "live";

export function apiMode(): ApiMode {
  return process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "demo";
}

export function isLiveMode() {
  return apiMode() === "live";
}
