// scripts/smoke-test.mjs
// Uji RLS & RPC end-to-end memakai publishable key + login nyata tiap role.
// Jalankan: npm run test:rls
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile?.(file);
  } catch {
    // opsional
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pub =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PW = process.env.SEED_PASSWORD ?? "Demo-Password-123!";

const EMP = {
  hr: "nadia.putri@example.test",
  manager: "dimas.saputra@example.test",
  eng: "rizky.pratama@example.test",
  other: "citra.lestari@example.test",
  off: "penguji.disabled@example.test",
};

let pass = 0;
let fail = 0;
function check(label, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function signIn(email) {
  const c = createClient(url, pub, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

const hr = await signIn(EMP.hr);
const { count: hrCount } = await hr.from("employees").select("id", { count: "exact" });
check("HR melihat seluruh direktori", hrCount === 10, `count=${hrCount}`);

const mgr = await signIn(EMP.manager);
const { data: mgrRows, count: mgrCount } = await mgr
  .from("employees")
  .select("full_name", { count: "exact" })
  .order("full_name");
check("Manager hanya melihat timnya (Engineering)", mgrCount === 3, `count=${mgrCount}`);
check(
  "Manager tidak melihat karyawan luar tim",
  !(mgrRows ?? []).some((r) => r.full_name === "Citra Lestari"),
);

const eng = await signIn(EMP.eng);
const { count: engCount } = await eng.from("employees").select("id", { count: "exact" });
check("Karyawan hanya melihat dirinya", engCount === 1, `count=${engCount}`);

const other = await signIn(EMP.other);
const { count: otherCount } = await other.from("employees").select("id", { count: "exact" });
check("Karyawan lain hanya melihat dirinya", otherCount === 1, `count=${otherCount}`);

// Manager tidak boleh menyentuh payroll.
const { count: mgrPayroll } = await mgr.from("payroll_runs").select("id", { count: "exact" });
check("Manager tidak melihat payroll", (mgrPayroll ?? 0) === 0, `count=${mgrPayroll}`);

// Karyawan tidak boleh memanggil RPC HR.
const { error: rpcErr } = await eng.rpc("create_employee", {
  p_employee_no: "X-1",
  p_full_name: "Uji Ilegal",
  p_work_email: "ilegal@example.test",
  p_department_id: "d0000000-0000-4000-8000-000000000001",
  p_position_id: "b0000000-0000-4000-8000-000000000001",
  p_employment_status: "ACTIVE",
  p_joined_on: "2026-01-01",
  p_phone: "081200009999",
  p_address: "Uji",
  p_base_salary_idr: 1,
});
check("Karyawan diblokir dari create_employee", Boolean(rpcErr), rpcErr?.message ?? "");

// Karyawan boleh membaca saldo cutinya sendiri.
const { data: lb, error: lbErr } = await eng.rpc("leave_balance", {
  p_employee: "e0000000-0000-4000-8000-000000000002",
  p_year: 2026,
});
const balance = Array.isArray(lb) ? lb[0] : lb;
check("Karyawan dapat saldo cuti sendiri", !lbErr && Boolean(balance), JSON.stringify(balance));

// Karyawan tidak boleh membaca saldo cuti orang lain.
const { error: lbErr2 } = await eng.rpc("leave_balance", {
  p_employee: "e0000000-0000-4000-8000-000000000005",
  p_year: 2026,
});
check("Karyawan diblokir dari saldo cuti orang lain", Boolean(lbErr2), lbErr2?.message ?? "");

// Akun DISABLED: login Auth boleh berhasil, tetapi tidak melihat data apa pun.
try {
  const off = await signIn(EMP.off);
  const { count: offCount } = await off.from("employees").select("id", { count: "exact" });
  check("Akun DISABLED tidak melihat data karyawan", (offCount ?? 0) === 0, `count=${offCount}`);
} catch (error) {
  check("Akun DISABLED tidak melihat data karyawan", false, error.message);
}

console.log(`\nRingkasan RLS: ${pass} pass, ${fail} fail.`);
process.exitCode = fail === 0 ? 0 : 1;