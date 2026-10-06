# 06 — Implementasi backend Supabase

**Status: SUDAH DITERAPKAN pada project staging `btzqutfgxsiyerfrzrhu`.** Migration
(0001–0005) sudah dijalankan, akun uji Auth sudah dibuat, dan uji RLS (10/10) serta
uji HTTP route handler (5/5) lulus. Yang **belum**: penggantian penuh data demo di
UI (`app/hris-app.tsx`) dengan sumber API — lihat Bagian 6.

## 1. Berkas yang ditambahkan

| Area | Berkas |
| --- | --- |
| Migration | `supabase/migrations/0001_schema.sql` … `0005_tighten_active.sql` |
| Klien Supabase | `lib/supabase/env.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts` |
| Proxy | `proxy.ts` (refresh session, no-op tanpa env; menggantikan `middleware.ts`) |
| Helper API | `lib/api/http.ts`, `actor.ts`, `errors.ts`, `query.ts`, `dto.ts`, `me.ts`, `payroll.ts` |
| Route Handler | `app/api/v1/**/route.ts` (31 endpoint) |
| Klien browser | `lib/api-client.ts` |
| Skrip | `scripts/seed-supabase.mjs`, `check-supabase.mjs`, `fetch-secret.mjs`, `db-apply.mjs`, `db-status.mjs`, `smoke-test.mjs`, `http-e2e.mjs` |
| Konfigurasi | `.env.example` (`SUPABASE_ACCESS_TOKEN` khusus CLI) |

## 2. Skrip bantu (npm)

| Perintah | Fungsi |
| --- | --- |
| `npm run supabase:check` | Validasi format URL/publishable/secret + uji konektivitas |
| `npm run supabase:fetch-secret` | Ambil secret key via Management API (PAT) & isi `.env` |
| `npm run db:apply` | Terapkan `supabase/migrations/*.sql` (Management API, urut) |
| `npm run db:status` | Ringkasan jumlah baris, tabel ber-RLS, dan fungsi RPC |
| `npm run seed:auth` | Buat akun Auth uji + `user_profiles` (service role) |
| `npm run test:rls` | Uji RLS/RPC end-to-end tiap role (allow/deny) |
| `npm run test:http` | Uji route handler `/api/v1` (butuh `npm run build`) |

> Catatan kredensial: `sbp_...` (Access Token akun) **hanya untuk CLI/Management API**
> (`SUPABASE_ACCESS_TOKEN`). Aplikasi memakai **Publishable** (`sb_publishable_...`)
> dan **Secret** (`sb_secret_...`) dari Project Settings → API Keys. Jangan tertukar.

## 3. Setup (project ini sudah selesai; untuk ulang dari nol)

```sh
npm install
# isi .env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
#           SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN (CLI)
npm run supabase:check     # semua OK
npm run db:apply           # terapkan migration 0001..0005
npm run seed:auth          # buat 7 akun uji
npm run test:rls           # 10/10
npm run build && npm run test:http   # 5/5
npm run dev                # http://localhost:5173
```

Alternatif CLI resmi: `npx supabase link --project-ref <ref>` lalu `npx supabase db push`.

## 4. Akun uji (sudah dibuat)

Sandi default `Demo-Password-123!` (`SEED_PASSWORD` untuk mengubah).

| Alias | Email | Role/status |
| --- | --- | --- |
| HR | nadia.putri@example.test | ADMIN_HR ACTIVE |
| M-ENG | dimas.saputra@example.test | MANAGER ACTIVE (Engineering) |
| E-ENG | rizky.pratama@example.test | EMPLOYEE ACTIVE (Engineering) |
| E-OTHER | citra.lestari@example.test | EMPLOYEE ACTIVE (Marketing) |
| E-OFF | bima.aditya@example.test | akun ACTIVE, karyawan INACTIVE |
| A-OFF | penguji.disabled@example.test | akun DISABLED |
| A-INV | penguji.invited@example.test | akun INVITED |

## 5. Cakupan kontrak yang sudah diimplementasikan

Semua method/path pada [kontrak API](01_API_CONTRACT.md) bagian 5 tersedia sebagai
Route Handler `app/api/v1`. Operasi tulis memakai RPC `SECURITY DEFINER`:
`leave_balance`, `create_employee`, `update_employee`, `update_own_contact`,
`attendance_check_in`, `attendance_check_out`, `create_leave_request`,
`decide_leave_request`, `create_payroll_run`, `update_payroll_item`,
`publish_payroll_run`, `upsert_performance_review`, `update_account`.

RLS + helper `private.*` menegakkan matriks [dokumen RLS](03_ACCESS_AND_RLS.md).
Migration `0005_tighten_active.sql` menutup celah: predikat "own" sekarang juga
menuntut `is_active_actor()`, sehingga akun DISABLED/inactive tidak membaca data
lewat Data API langsung. `private.employee_compensation`, `private.audit_events`,
dan `private.operation_requests` tidak diekspos sebagai Data API.

## 6. Hasil verifikasi (dijalankan nyata)

- `npx tsc --noEmit` — lulus.
- `npm test` — 6 unit test lulus.
- `npm run build` — 31 route handler + proxy terkompilasi.
- `npm run db:status` — 10 karyawan, 5 departemen, 8 jabatan, 7 akun; RLS aktif
  pada 12 tabel; 13 fungsi RPC.
- `npm run test:rls` — **10/10 lulus** (allow/deny HR/Manager/Karyawan/DISABLED,
  self vs tim vs luar tim, blokir RPC ilegal, saldo cuti sendiri vs orang lain).
- `npm run test:http` — **5/5 lulus** (401 salah/no-session, 200 login HR + cookie,
  403 akun DISABLED).

## 7. Langkah integrasi frontend (sisa pekerjaan)

1. Aktifkan mode backend ketika env Supabase ada (mis. `isSupabaseConfigured()`),
   lalu ganti sumber data `app/hris-app.tsx` bertahap per modul memakai
   `lib/api-client.ts`.
2. Ganti pemilih "Ganti peran demo" dengan login nyata (`hrApi.login`) + `hrApi.me`;
   hapus role dari state klien.
3. Petakan DTO kontrak ke bentuk UI (Bagian 8 kontrak API): `id` UUID (bukan number),
   `period` `YYYY-MM`, uang `*Idr` integer, timestamp UTC → format WIB.
4. Jangan memakai fallback seed saat mode terintegrasi — tampilkan state
   loading/error/retry agar kegagalan API tidak disamarkan.

## 8. Batasan jujur

- Uji RLS/smoke di repo ini menjalankan query sebagai user nyata, tetapi belum
  menjadi suite otomatis ber-CI; jalankan manual sebelum rilis.
- Uji concurrency (dua publish bersamaan, dua pengajuan bentrok) belum dijadwalkan.
- Undangan memakai `inviteUserByEmail` + `operation_requests`; rekonsiliasi
  kegagalan lintas layanan masih sederhana.
- Kalender libur nasional, pro-rata karyawan baru, carry-over, koreksi presensi,
  dan supervisor lintas departemen di luar v1.
- `.env` berisi kredensial asli: jangan commit; gunakan data fiktif di staging.