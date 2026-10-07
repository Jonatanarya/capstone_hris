# Deployment PeopleSpace

Pilihan awal: Next.js + Node.js 24 + Vercel, sesuai dokumen perencanaan. Tidak perlu Express untuk frontend ini.

## Aktivasi Vercel

Status (2026-10-06): **aktif penuh — frontend + backend + database terintegrasi**.
Project `peoplespace-hris` (team `jonatanaryas-2058s-projects`) berisi secrets
`VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` + variable `ENABLE_VERCEL_DEPLOY=true`,
dan environment Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_API_MODE=live`) untuk target *production* dan
*preview*. Deploy produksi berhasil ke `https://peoplespace-hris.vercel.app` dan
terbukti melayani data Supabase asli (lihat log verifikasi di bawah).

1. **[selesai]** Buat/link project Vercel untuk repository `Jonatanarya/capstone_hris`. Root directory repository ini, framework Next.js, build `npm run build`, install `npm ci`, versi Node.js 24.
2. **[selesai]** Ambil project ID dan organization/team ID dari pengaturan project atau `.vercel/project.json` setelah `vercel link`. Buat token di akun Vercel dengan hak minimum yang diperlukan. Jangan kirim token melalui chat atau commit.
3. **[selesai]** Pada GitHub Settings → Secrets and variables → Actions, tambahkan secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Jika menggunakan environment secrets, letakkan di environment `production`.
4. **[selesai]** Tambahkan variable repository `ENABLE_VERCEL_DEPLOY` dengan nilai `true` setelah provider disetujui dan secrets lengkap. Sebelumnya CD sengaja skipped.
5. Jalankan ulang workflow **Frontend CI** untuk `main` atau push perubahan baru. Setelah sukses, **Deploy Vercel** mengambil SHA persis yang lolos CI dan memakai pull/build/deploy prebuilt.
6. **[selesai]** Variabel environment Supabase pada project Vercel (`NEXT_PUBLIC_SUPABASE_URL`, publishable key, dan `SUPABASE_SERVICE_ROLE_KEY` server-only) plus `NEXT_PUBLIC_API_MODE=live` sudah dipasang untuk production + preview, sehingga `/api/v1/*` berjalan terhadap database Supabase asli.

`vercel.json` menonaktifkan deployment otomatis Git agar tidak melompati quality gate Actions. Bila memilih integrasi Git bawaan, hapus pilihan tersebut dan rancang gerbang promotion sesuai kebutuhan; jangan menjalankan dua pipeline produksi sekaligus.

Deploy produksi pertama berhasil pada 2026-10-06 (`peoplespace-hris.vercel.app`).
Token Vercel pernah dibagikan melalui chat: **rotasi token di Vercel Dashboard →
Settings → Tokens** setelah verifikasi selesai lalu perbarui secret `VERCEL_TOKEN`.
GitHub Pages adalah alternatif demo statis, bukan deployment server Next.js;
jangan mengaktifkan kedua provider tanpa keputusan kelompok.

### Log verifikasi live (2026-10-06, mode `NEXT_PUBLIC_API_MODE=live`)

Diuji langsung ke `https://peoplespace-hris.vercel.app`:

- `GET /` → **200**.
- Tanpa sesi: `GET /api/v1/me` → **401** (sebelumnya 500 saat Supabase belum di-set).
- `POST /api/v1/auth/login` `nadia.putri@example.test` → **200**, `ADMIN_HR`, cookie sesi ter-set.
- Sesi ADMIN_HR: `me` 200, `dashboard` **200** (`scope=ORGANIZATION`, `period=2026-10`),
  `employees` **200** (10 baris), `departments` 200, `positions` 200, `leave-requests` 200,
  `attendance` 200, `payroll-runs` 200, `accounts` 200, `reports/employees` 200.
- RLS terbukti di produksi: MANAGER `dimas.saputra` → `/employees` **200**;
  EMPLOYEE `rizky.pratama` → `/employees` **403 FORBIDDEN**;
  akun nonaktif `bima.aditya` → login **403** (`EMPLOYEE_INACTIVE`).

Status hardening terbaru dan batas pengujian ada di [perbaikan full-stack](PERBAIKAN_FULLSTACK_2026-10-07.md).

Sumber data nyata memakai project Supabase `btzqutfgxsiyerfrzrhu`
(12 tabel, RLS aktif, RPC bisnis) dengan akun uji seed (sandi tidak dipublikasikan).
Akun uji hanya untuk demo akademik; ganti sandi sebelum dipakai publik.

### Temuan E2E alur tulis (2026-10-06, lanjutan)

Uji tulis end-to-end ke produksi (login per peran, cuti → approve manager,
penilaian, presensi, payroll draft → item → publish) menemukan dua bug runtime
yang lalu diperbaiki dan diverifikasi ulang (**27/27 lulus**):

- `attendance_check_in` mengembalikan **500** karena `case when ... end` bertipe
  `text` sementara kolom `attendances.status` bertipe enum
  `public.attendance_status` (PG 42804). Diperbaiki dengan cast eksplisit dan
  migrasi `0006_fix_attendance_check_in.sql`; kini **201** (atau **409**
  `ALREADY_CHECKED_IN` bila sudah absen hari itu).
- Revisi penilaian (`PUT /employees/{id}/performance-reviews/{period}`) selalu
  **409** `VERSION_CONFLICT` karena UI tidak mengirim `expectedVersion`; kini
  versi tersimpan dari GET dan dikirim saat revisi.

Deploy produksi setelah perbaikan: CI `37508628014` dan Deploy `37508859558`
sukses (`d2e4ecd`).

## Pengamanan GitHub

CI memakai `contents: read`; CD tidak menerima artifact atau source dari fork/PR. Kredensial hanya diberikan ke job deploy untuk commit main pada repository sendiri yang lolos CI. Workflow checkout SHA yang diuji, bukan selalu HEAD yang bisa berubah.

Disarankan aktifkan branch protection/ruleset `main`, wajibkan check `validate` dan review sebelum merge. Pengaturan ini belum diubah otomatis. Untuk production environment tambahkan approval reviewer jika diperlukan.

## Rollback

Jika versi baru bermasalah, gunakan deployment sebelumnya di dashboard Vercel, kemudian buat commit perbaikan/revert di GitHub agar source sinkron. Jangan reset paksa history. Frontend belum mempunyai migrasi database; kelak rollback data memerlukan prosedur terpisah.

## Referensi

- [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying)
- [GitHub Actions Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [Vercel + GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)
