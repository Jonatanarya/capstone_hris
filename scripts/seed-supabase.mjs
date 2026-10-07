// scripts/seed-supabase.mjs
// Provision akun Auth fiktif + user_profiles memakai service role.
// Jalankan: npm run seed:auth   (membaca .env.local lalu .env)
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile?.(file);
  } catch {
    // Berkas opsional; env bisa juga berasal dari shell.
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12) {
  console.error("SEED_PASSWORD wajib diisi secara privat (minimal 12 karakter), tanpa sandi bawaan.");
  process.exit(1);
}
const projectRef = url ? new URL(url).hostname.split(".")[0] : "";
if (projectRef !== "localhost" && projectRef !== "127" && process.env.SEED_CONFIRM_PROJECT !== projectRef) {
  console.error("Seed remote ditolak. Hanya jalankan pada staging yang disengaja dengan SEED_CONFIRM_PROJECT yang cocok.");
  process.exit(1);
}

if (!url || !secret) {
  console.error(
    "Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (di .env.local).",
  );
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Alias fixture per docs/backend-handoff/05_TEST_AND_DELIVERY.md
const fixtures = [
  { alias: "HR",      email: "nadia.putri@example.test",    employee: "e0000000-0000-4000-8000-000000000001", role: "ADMIN_HR", status: "ACTIVE" },
  { alias: "M-ENG",   email: "dimas.saputra@example.test",  employee: "e0000000-0000-4000-8000-000000000004", role: "MANAGER",  status: "ACTIVE" },
  { alias: "E-ENG",   email: "rizky.pratama@example.test",  employee: "e0000000-0000-4000-8000-000000000002", role: "EMPLOYEE", status: "ACTIVE" },
  { alias: "E-OTHER", email: "citra.lestari@example.test",  employee: "e0000000-0000-4000-8000-000000000005", role: "EMPLOYEE", status: "ACTIVE" },
  { alias: "E-OFF",   email: "bima.aditya@example.test",    employee: "e0000000-0000-4000-8000-000000000008", role: "EMPLOYEE", status: "ACTIVE" },
  { alias: "A-OFF",   email: "penguji.disabled@example.test", employee: "e0000000-0000-4000-8000-000000000009", role: "EMPLOYEE", status: "DISABLED" },
  { alias: "A-INV",   email: "penguji.invited@example.test",  employee: "e0000000-0000-4000-8000-000000000010", role: "EMPLOYEE", status: "INVITED" },
];

async function findUserIdByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
}

let ok = 0;
let failed = 0;

for (const f of fixtures) {
  try {
    let userId = await findUserIdByEmail(f.email);
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: f.email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      userId = data.user.id;
    }

    const { error: profileError } = await admin
      .from("user_profiles")
      .upsert(
        { user_id: userId, employee_id: f.employee, role: f.role, account_status: f.status },
        { onConflict: "user_id" },
      );
    if (profileError) throw profileError;

    console.log(`ok   ${f.alias.padEnd(8)} ${f.email} (${f.role}/${f.status})`);
    ok += 1;
  } catch (error) {
    console.error(`FAIL ${f.alias.padEnd(8)} ${f.email}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\nSelesai: ${ok} sukses, ${failed} gagal. Kata sandi tidak ditampilkan.`);
