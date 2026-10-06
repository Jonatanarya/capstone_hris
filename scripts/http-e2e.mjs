// scripts/http-e2e.mjs
// Uji end-to-end route handler /api/v1 memakai server Next.js produksi.
// Butuh `npm run build` lebih dulu. Jalankan: npm run test:http
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const PORT = Number(process.env.E2E_PORT ?? 5173);
const base = `http://localhost:${PORT}`;
const PW = process.env.SEED_PASSWORD ?? "Demo-Password-123!";

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", String(PORT)],
  { stdio: "ignore", env: process.env },
);

let pass = 0;
let fail = 0;
const check = (label, ok, detail = "") => {
  (ok ? pass++ : fail++);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

async function waitReady() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${base}/api/v1/me`);
      if (res.status) return true;
    } catch {
      // belum siap
    }
    await delay(500);
  }
  return false;
}

try {
  const ready = await waitReady();
  if (!ready) throw new Error("server tidak siap");

  // 1. Kredensial salah → 401 INVALID_CREDENTIALS
  let res = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "rizky.pratama@example.test", password: "salah" }),
  });
  let body = await res.json();
  check("Login salah → 401 INVALID_CREDENTIALS", res.status === 401 && body?.error?.code === "INVALID_CREDENTIALS", `status=${res.status} code=${body?.error?.code}`);

  // 2. Tanpa session → 401 UNAUTHENTICATED
  res = await fetch(`${base}/api/v1/me`);
  body = await res.json();
  check("Tanpa session → 401 UNAUTHENTICATED", res.status === 401 && body?.error?.code === "UNAUTHENTICATED", `status=${res.status} code=${body?.error?.code}`);

  // 3. Login valid HR → 200 + cookie session + role ADMIN_HR
  res = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nadia.putri@example.test", password: PW }),
  });
  body = await res.json();
  const cookies = res.headers.getSetCookie?.() ?? [];
  check("Login HR → 200 role ADMIN_HR", res.status === 200 && body?.data?.role === "ADMIN_HR", `status=${res.status} role=${body?.data?.role}`);
  check("Login menyetel cookie session", cookies.length > 0, `setCookie=${cookies.length}`);

  // 4. Akun DISABLED → 403 ACCOUNT_DISABLED
  res = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "penguji.disabled@example.test", password: PW }),
  });
  body = await res.json();
  check("Login akun DISABLED → 403 ACCOUNT_DISABLED", res.status === 403 && body?.error?.code === "ACCOUNT_DISABLED", `status=${res.status} code=${body?.error?.code}`);

  // 5. Karyawan: presensi check-in tidak boleh 500 (regresi cast enum attendance_status)
  res = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "rizky.pratama@example.test", password: PW }),
  });
  const empCookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  body = await res.json();
  check("Login EMPLOYEE → 200 role EMPLOYEE", res.status === 200 && body?.data?.role === "EMPLOYEE", `status=${res.status} role=${body?.data?.role}`);

  res = await fetch(`${base}/api/v1/attendance/check-in`, {
    method: "POST",
    headers: { Cookie: empCookie },
  });
  body = await res.json();
  check(
    "POST /attendance/check-in → 201/409 ALREADY_CHECKED_IN (bukan 500)",
    res.status === 201 || (res.status === 409 && body?.error?.code === "ALREADY_CHECKED_IN"),
    `status=${res.status} code=${body?.error?.code ?? body?.data?.status}`,
  );

  // 6. Karyawan tidak boleh membaca daftar semua karyawan (RLS/otorisasi)
  res = await fetch(`${base}/api/v1/employees`, { headers: { Cookie: empCookie } });
  body = await res.json();
  check("EMPLOYEE GET /employees → 403 FORBIDDEN", res.status === 403 && body?.error?.code === "FORBIDDEN", `status=${res.status} code=${body?.error?.code}`);
} catch (error) {
  check("E2E berjalan", false, error.message);
} finally {
  child.kill();
}

console.log(`\nRingkasan HTTP: ${pass} pass, ${fail} fail.`);
process.exitCode = fail === 0 ? 0 : 1;