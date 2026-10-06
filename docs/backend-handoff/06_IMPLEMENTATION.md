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
- `npm test` — 32 unit test lulus (4 berkas: `hris`, `api-mode`, `api-adapters`, `api-client`).
- `npm audit --omit=dev --audit-level=high` — **0 vulnerabilities**; `sharp` 0.35.5
  (GHSA-wq5f-xc86-pv6w) dan `source-map-js` 1.2.2 (GHSA-68fv-2mgg-jv7q) di-pin via `overrides`.
- `npm run build` — 31 route handler + proxy terkompilasi.
- `npm run db:status` — 10 karyawan, 5 departemen, 8 jabatan, 7 akun; RLS aktif
  pada 12 tabel; 13 fungsi RPC.
- `npm run test:rls` — **10/10 lulus** (allow/deny HR/Manager/Karyawan/DISABLED,
  self vs tim vs luar tim, blokir RPC ilegal, saldo cuti sendiri vs orang lain).
- `npm run test:http` — **5/5 lulus** (401 salah/no-session, 200 login HR + cookie,
  403 akun DISABLED).

## 7. Langkah integrasi frontend (SELESAI — diverifikasi live 2026-10-06)

Status: keempat langkah sudah diterapkan. UI memilih sumber data lewat
`lib/api-mode.ts` (`NEXT_PUBLIC_API_MODE=live`), memakai `lib/api-client.ts` +
`lib/api-adapters.ts`, dan sudah diuji terhadap Supabase asli lewat
`https://peoplespace-hris.vercel.app` (lihat log di `docs/DEPLOYMENT.md`).
Catatan: gerbang mode memakai `NEXT_PUBLIC_API_MODE`, bukan `isSupabaseConfigured()`,
supaya mode demo tetap bisa dipakai untuk build/test/e2e tanpa backend.

1. **[selesai]** Aktifkan mode backend; ganti sumber data `app/hris-app.tsx` per modul
   memakai `lib/api-client.ts` (29 method `hrApi.*` dipakai).
2. **[selesai]** Pemilih "Ganti peran demo" diganti login nyata (`hrApi.login`) +
   `hrApi.me`; pemilih peran dimatikan saat mode live (`if (live) return;`).
3. **[selesai]** DTO kontrak dipetakan ke bentuk UI di `lib/api-adapters.ts`: `id` UUID,
   `period` `YYYY-MM`, uang `*Idr` integer, timestamp UTC → format WIB.
4. **[selesai]** Tidak ada fallback seed saat mode live — ditampilkan state
   loading/error/retry agar kegagalan API tidak disamarkan (mis. 500 → toast).

### Temuan E2E produksi lanjutan (2026-10-06, alur tulis)

Smoke E2E per peran (login, cuti → approve manager, penilaian, presensi,
payroll draft → item → publish) menemukan dan memperbaiki dua bug runtime:

- **`attendance_check_in` 500 (PostgreSQL 42804).** `case when ... then 'LATE'
  else 'PRESENT' end` bertipe `text`, sedangkan kolom `attendances.status`
  bertipe enum `public.attendance_status` (tanpa implicit cast). Ditambahkan cast
  eksplisit di `0003_rpc.sql` dan migrasi idempoten `0006_fix_attendance_check_in.sql`
  untuk DB yang sudah termigrasi.
- **Revisi penilaian selalu 409 `VERSION_CONFLICT`.** UI tidak menyimpan/mengirim
  `expectedVersion` saat mengedit review yang sudah ada. `version` dari GET kini
  disimpan di state dan disertakan pada PUT revisi.

Hasil ulang setelah perbaikan: E2E produksi **27/27 lulus** (termasuk check-in
201/409 dan payroll `DRAFT → net 8.800.000 → PUBLISHED`), `tsc`/`eslint`/32 unit
test hijau. Regresi ditambahkan ke `scripts/http-e2e.mjs` (check-in bukan 500,
EMPLOYEE `/employees` 403). CI `37508628014` dan Deploy `37508859558` sukses.

## 8. Batasan jujur

- Uji RLS/smoke di repo ini menjalankan query sebagai user nyata, tetapi belum
  menjadi suite otomatis ber-CI; jalankan manual sebelum rilis.
- Uji concurrency (dua publish bersamaan, dua pengajuan bentrok) belum dijadwalkan.
- Undangan memakai `inviteUserByEmail` + `operation_requests`; rekonsiliasi
  kegagalan lintas layanan masih sederhana.
- Kalender libur nasional, pro-rata karyawan baru, carry-over, koreksi presensi,
  dan supervisor lintas departemen di luar v1.
- `.env` berisi kredensial asli: jangan commit; gunakan data fiktif di staging.