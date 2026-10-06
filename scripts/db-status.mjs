// scripts/db-status.mjs
// Ringkasan cepat isi database (jumlah baris + status RLS). Read-only.
// Jalankan: npm run db:status
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile?.(file);
  } catch {
    // opsional
  }
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^https:\/\//, "").split(".")[0];

async function q(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { ok: res.ok, body: await res.text() };
}

const counts = await q(`
  select
    (select count(*) from public.employees) as employees,
    (select count(*) from public.departments) as departments,
    (select count(*) from public.positions) as positions,
    (select count(*) from public.user_profiles) as accounts,
    (select count(*) from public.leave_requests) as leave_requests,
    (select count(*) from public.attendances) as attendances;
`);
console.log("Jumlah baris:", counts.body);

const rls = await q(`
  select tablename from pg_tables
  where schemaname in ('public') and rowsecurity = true order by tablename;
`);
console.log("Tabel ber-RLS:", rls.body);

const funcs = await q(`
  select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' order by proname;
`);
console.log("Fungsi public:", funcs.body);