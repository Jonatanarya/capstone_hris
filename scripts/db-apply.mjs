// scripts/db-apply.mjs
// Terapkan migration supabase/migrations/*.sql ke project via Management API
// (butuh SUPABASE_ACCESS_TOKEN sbp_ dengan scope database:write).
// Jalankan: npm run db:apply -- 0007 --dry-run (validasi + rollback)
//           npm run db:apply -- 0007 (file eksplisit, atomik + ledger checksum)
// Replay seluruh schema/seed ditolak; migration yang tercatat tidak dijalankan ulang.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

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
  console.error(
    "Butuh SUPABASE_ACCESS_TOKEN dan NEXT_PUBLIC_SUPABASE_URL di .env.",
  );
  process.exitCode = 1;
} else {
  const dir = join("supabase", "migrations");
  const dryRun = process.argv.includes("--dry-run");
  const filters = process.argv.slice(2).filter((x) => x !== "--dry-run");
  if (!filters.length) {
    console.error(
      "Tentukan nomor migration secara eksplisit. Replay seluruh schema/seed produksi ditolak.",
    );
    process.exit(1);
  }
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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      },
    );
    return { ok: res.ok, status: res.status, text: await res.text() };
  };

  console.log(`Menerapkan ${files.length} migration ke ${ref}...\n`);
  let failed = 0;
  let completed = 0;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8").replace(/\r\n/g, "\n");
    const hash = createHash("sha256").update(sql).digest("hex");
    const safeName = file.replace(/'/g, "''");
    const query = `begin;
      select pg_advisory_xact_lock(740701099::bigint);
      create table if not exists private.app_migrations(name text primary key, sha256 text not null, applied_at timestamptz not null default now());
      do $ledger$ begin
        if exists(select 1 from private.app_migrations where name='${safeName}' and sha256<>'${hash}') then
          raise exception 'MIGRATION_CHECKSUM_MISMATCH';
        end if;
        if exists(select 1 from private.app_migrations where name='${safeName}') then
          raise exception 'MIGRATION_ALREADY_APPLIED';
        end if;
      end $ledger$;
      ${sql}
      insert into private.app_migrations(name,sha256) values('${safeName}','${hash}');
      ${dryRun ? "rollback" : "commit"};`;
    const { ok, status, text } = await runQuery(query);
    if (ok) {
      completed += 1;
      console.log(
        `OK   ${file}${dryRun ? " (validated then rolled back)" : ""}`,
      );
    } else {
      failed += 1;
      console.log(`FAIL ${file} (HTTP ${status}): ${text.slice(0, 400)}`);
      break;
    }
  }
  console.log(`\n${completed}/${files.length} berhasil.`);
  if (failed) process.exitCode = 1;
}
