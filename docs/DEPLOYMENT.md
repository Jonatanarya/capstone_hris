# Deployment PeopleSpace

Pilihan awal: Next.js + Node.js 24 + Vercel, sesuai dokumen perencanaan. Tidak perlu Express untuk frontend ini.

## Aktivasi Vercel

Status (2026-10-06): **aktif**. Project `peoplespace-hris` sudah dibuat di team
`jonatanaryas-2058s-projects`, secrets `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`
dan variable `ENABLE_VERCEL_DEPLOY=true` sudah terpasang, dan deploy produksi
pertama sudah berhasil (`https://peoplespace-hris.vercel.app`).

1. **[selesai]** Buat/link project Vercel untuk repository `Jonatanarya/capstone_hris`. Root directory repository ini, framework Next.js, build `npm run build`, install `npm ci`, versi Node.js 24.
2. **[selesai]** Ambil project ID dan organization/team ID dari pengaturan project atau `.vercel/project.json` setelah `vercel link`. Buat token di akun Vercel dengan hak minimum yang diperlukan. Jangan kirim token melalui chat atau commit.
3. **[selesai]** Pada GitHub Settings → Secrets and variables → Actions, tambahkan secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Jika menggunakan environment secrets, letakkan di environment `production`.
4. **[selesai]** Tambahkan variable repository `ENABLE_VERCEL_DEPLOY` dengan nilai `true` setelah provider disetujui dan secrets lengkap. Sebelumnya CD sengaja skipped.
5. Jalankan ulang workflow **Frontend CI** untuk `main` atau push perubahan baru. Setelah sukses, **Deploy Vercel** mengambil SHA persis yang lolos CI dan memakai pull/build/deploy prebuilt.
6. **Sisa:** set variabel environment Supabase pada project Vercel (`NEXT_PUBLIC_SUPABASE_URL`, publishable/anon key, dan `SUPABASE_SERVICE_ROLE_KEY` server-only) agar mode backend aktif. Tanpa itu `/api/v1/*` mengembalikan 500 dan halaman tetap memakai data contoh. Setelah terisi, buka URL deployment dan ulangi smoke test: dashboard, pergantian peran, navigasi ponsel, cuti dan payroll.

`vercel.json` menonaktifkan deployment otomatis Git agar tidak melompati quality gate Actions. Bila memilih integrasi Git bawaan, hapus pilihan tersebut dan rancang gerbang promotion sesuai kebutuhan; jangan menjalankan dua pipeline produksi sekaligus.

Deploy produksi pertama berhasil pada 2026-10-06 (`peoplespace-hris.vercel.app`,
home `200` dengan data contoh). Token Vercel pernah dibagikan melalui chat: **rotasi
token di Vercel Dashboard → Settings → Tokens** setelah verifikasi selesai lalu
perbarui secret `VERCEL_TOKEN`. GitHub Pages adalah alternatif demo statis, bukan
deployment server Next.js; jangan mengaktifkan kedua provider tanpa keputusan kelompok.

## Pengamanan GitHub

CI memakai `contents: read`; CD tidak menerima artifact atau source dari fork/PR. Kredensial hanya diberikan ke job deploy untuk commit main pada repository sendiri yang lolos CI. Workflow checkout SHA yang diuji, bukan selalu HEAD yang bisa berubah.

Disarankan aktifkan branch protection/ruleset `main`, wajibkan check `validate` dan review sebelum merge. Pengaturan ini belum diubah otomatis. Untuk production environment tambahkan approval reviewer jika diperlukan.

## Rollback

Jika versi baru bermasalah, gunakan deployment sebelumnya di dashboard Vercel, kemudian buat commit perbaikan/revert di GitHub agar source sinkron. Jangan reset paksa history. Frontend belum mempunyai migrasi database; kelak rollback data memerlukan prosedur terpisah.

## Referensi

- [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying)
- [GitHub Actions Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [Vercel + GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)
