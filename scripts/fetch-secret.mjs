// scripts/fetch-secret.mjs
// Mengambil daftar API key project via Management API (butuh SUPABASE_ACCESS_TOKEN sbp_).
// Bila SUPABASE_SERVICE_ROLE_KEY masih kosong, mengisinya otomatis dari secret key
// yang ditemukan. Rahasia tidak pernah dicetak (hanya preview ter-mask).
// Jalankan: npm run supabase:fetch-secret
import { readFileSync, writeFileSync } from "node:fs";

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

if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN (sbp_...) belum diatur di .env.");
  process.exitCode = 1;
} else {
  const mask = (v) => (v && v.length > 16 ? `${v.slice(0, 10)}..${v.slice(-4)}` : v ? "(pendek)" : "(null)");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    console.error(`Management API gagal: HTTP ${res.status}. Periksa PAT & project ref (${ref}).`);
    process.exitCode = 1;
  } else {
    const keys = await res.json();
    let secret = "";
    console.log(`API keys untuk project ${ref}:`);
    for (const k of keys) {
      const type = k.type ?? k.name ?? "?";
      console.log(`  - ${String(type).padEnd(12)} ${mask(k.api_key)}`);
      if (k.type === "secret" || k.type === "service_role") {
        secret = k.api_key ?? "";
      }
    }

    // Cari file env yang menampung SUPABASE_SERVICE_ROLE_KEY.
      // Catatan: pakai [ \t] (bukan \s) agar tidak menelan newline/baris berikutnya.
      const re = /^([ \t]*SUPABASE_SERVICE_ROLE_KEY[ \t]*=[ \t]*)(.*)$/m;
      for (const file of [".env", ".env.local"]) {
        let text;
        try {
          text = readFileSync(file, "utf8");
        } catch {
          continue;
        }
        const m = text.match(re);
        if (!m) continue;
        if (m[2].trim()) {
          console.log(`\n${file}: SUPABASE_SERVICE_ROLE_KEY sudah terisi, tidak diubah.`);
        } else if (secret) {
          text = text.replace(re, (_all, prefix) => prefix + secret);
          writeFileSync(file, text);
          console.log(`\n${file}: SUPABASE_SERVICE_ROLE_KEY diisi otomatis (${mask(secret)}).`);
        } else {
          console.log(`\n${file}: secret key tidak ditemukan (apakah project masih legacy?).`);
        }
      }
  }
}