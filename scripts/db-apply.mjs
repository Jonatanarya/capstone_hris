// scripts/db-apply.mjs
// Terapkan migration supabase/migrations/*.sql ke project via Management API
// (butuh SUPABASE_ACCESS_TOKEN sbp_ dengan scope database:write).
// Jalankan: npm run db:apply         (semua file, urut)
//           npm run db:apply -- 0001 (hanya file yang namanya memuat "0001")
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile?.(file);
  } catch {
    // opsional
  }
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const ref = url.replace(/^https:\/\//, "").split(".")[0];

if (!token || !ref) {
  console.error("Butuh SUPABASE_ACCESS_TOKEN dan NEXT_PUBLIC_SUPABASE_URL di .env.");
  process.exitCode = 1;
} else {
  const dir = join("supabase", "migrations");
  const filters = process.argv.slice(2);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => (filters.length ? filters.some((x) => f.includes(x)) : true))
    .sort();

  if (files.length === 0) {
    console.error("Tidak ada file migration yang cocok.");
    process.exitCode = 1;
  }

  const runQuery = async (query) => {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      },
    );
    return { ok: res.ok, status: res.status, text: await res.text() };
  };

  console.log(`Menerapkan ${files.length} migration ke ${ref}...\n`);
  let failed = 0;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    const { ok, status, text } = await runQuery(sql);
    if (ok) {
      console.log(`OK   ${file}`);
    } else {
      failed += 1;
      console.log(`FAIL ${file} (HTTP ${status}): ${text.slice(0, 400)}`);
    }
  }
  console.log(`\n${files.length - failed}/${files.length} berhasil.`);
  if (failed) process.exitCode = 1;
}