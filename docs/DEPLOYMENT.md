# Deployment PeopleSpace

Pilihan awal: Next.js + Node.js 24 + Vercel, sesuai dokumen perencanaan. Tidak perlu Express untuk frontend ini.

## Aktivasi Vercel

1. Buat/link project Vercel untuk repository `Jonatanarya/capstone_hris`. Root directory repository ini, framework Next.js, build `npm run build`, install `npm ci`, versi Node.js 24.
2. Ambil project ID dan organization/team ID dari pengaturan project atau `.vercel/project.json` setelah `vercel link`. Buat token di akun Vercel dengan hak minimum yang diperlukan. Jangan kirim token melalui chat atau commit.
3. Pada GitHub Settings → Secrets and variables → Actions, tambahkan secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Jika menggunakan environment secrets, letakkan di environment `production`.
4. Tambahkan variable repository `ENABLE_VERCEL_DEPLOY` dengan nilai `true` setelah provider disetujui dan secrets lengkap. Sebelumnya CD sengaja skipped.
5. Jalankan ulang workflow **Frontend CI** untuk `main` atau push perubahan baru. Setelah sukses, **Deploy Vercel** mengambil SHA persis yang lolos CI dan memakai pull/build/deploy prebuilt.
6. Buka URL deployment pada log Vercel dan ulangi smoke test: dashboard, pergantian peran, navigasi ponsel, cuti dan payroll. URL publik harus tetap memakai data contoh.

`vercel.json` menonaktifkan deployment otomatis Git agar tidak melompati quality gate Actions. Bila memilih integrasi Git bawaan, hapus pilihan tersebut dan rancang gerbang promotion sesuai kebutuhan; jangan menjalankan dua pipeline produksi sekaligus.

Saat audit, repository tidak memiliki secrets Vercel. Tidak ada deploy live yang diklaim sudah berhasil. Workflow deployment belum dapat diuji end-to-end tanpa akun/project tersebut. GitHub Pages adalah alternatif demo statis, bukan deployment server Next.js; jangan mengaktifkan kedua provider tanpa keputusan kelompok.

## Pengamanan GitHub

CI memakai `contents: read`; CD tidak menerima artifact atau source dari fork/PR. Kredensial hanya diberikan ke job deploy untuk commit main pada repository sendiri yang lolos CI. Workflow checkout SHA yang diuji, bukan selalu HEAD yang bisa berubah.

Disarankan aktifkan branch protection/ruleset `main`, wajibkan check `validate` dan review sebelum merge. Pengaturan ini belum diubah otomatis. Untuk production environment tambahkan approval reviewer jika diperlukan.

## Rollback

Jika versi baru bermasalah, gunakan deployment sebelumnya di dashboard Vercel, kemudian buat commit perbaikan/revert di GitHub agar source sinkron. Jangan reset paksa history. Frontend belum mempunyai migrasi database; kelak rollback data memerlukan prosedur terpisah.

## Referensi

- [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying)
- [GitHub Actions Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [Vercel + GitHub Actions](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)
