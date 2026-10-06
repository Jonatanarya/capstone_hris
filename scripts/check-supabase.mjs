// scripts/check-supabase.mjs
// Periksa apakah konfigurasi Supabase di .env/.env.local sudah benar.
// Jalankan: npm run supabase:check
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile?.(file);
  } catch {
    // opsional
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const publishable = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

let problems = 0;
const ok = (label, detail) => console.log(`OK    ${label}: ${detail}`);
const bad = (label, detail) => {
  problems += 1;
  console.log(`MASALAH ${label}: ${detail}`);
};

// URL
if (/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)) {
  ok("URL", url);
} else if (/your-project-ref|example|localhost/.test(url) || !url) {
  bad("URL", `masih placeholder/kosong → "${url || "(kosong)"}". Isi https://<ref>.supabase.co`);
} else {
  bad("URL", `pola tidak sesuai (${url}). Harus https://<ref-20-karakter>.supabase.co`);
}

// Publishable / anon
if (/^eyJ[\w-]*\.[\w-]*\.[\w-]*$/.test(publishable)) {
  ok("Publishable", "JWT legacy (anon) terdeteksi");
} else if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(publishable)) {
  ok("Publishable", "publishable key terdeteksi");
} else if (!publishable) {
  bad("Publishable", "kosong. Isi NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
} else {
  bad("Publishable", `format tidak dikenal (len=${publishable.length}). Ambil dari Project Settings → API`);
}

// Service role / secret
if (/^eyJ[\w-]*\.[\w-]*\.[\w-]*$/.test(secret)) {
  ok("Secret", "JWT legacy (service_role) terdeteksi");
} else if (/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(secret)) {
  ok("Secret", "secret key baru terdeteksi");
} else if (/^sbp_/.test(secret)) {
  bad(
    "Secret",
    "ini Personal Access Token (sbp_...), BUKAN service role key. PAT untuk `supabase login`/Management API.",
  );
} else if (!secret) {
  bad("Secret", "kosong. Isi SUPABASE_SERVICE_ROLE_KEY (server-only)");
} else {
  bad("Secret", `format tidak dikenal (len=${secret.length})`);
}

// Uji konektivitas hanya bila URL/format dasar wajar.
if (!/your-project-ref/.test(url) && /^https:\/\//.test(url) && publishable) {
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishable },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) ok("Koneksi", `Supabase Auth merespons ${res.status}`);
    else bad("Koneksi", `HTTP ${res.status} — periksa URL/key`);
  } catch (error) {
    bad("Koneksi", `gagal menghubungi project: ${error.message}`);
  }
}

console.log(problems === 0 ? "\nSemua konfigurasi wajar." : `\n${problems} masalah perlu diperbaiki.`);
process.exitCode = problems === 0 ? 0 : 1;