# Audit alur demo HRIS — 11 Oktober 2026

## Cakupan implementasi

Layanan pribadi semua role, persetujuan cuti/fallback HR tanpa self-approval, pembatalan pending dengan history dan quota release, kalender/kebijakan HR, status presensi server, koreksi absensi terotorisasi, password pribadi opsional, read receipt notifikasi, audit read-only, dan konfirmasi penonaktifan. Panduan serta batas lingkup: [DEMO_CAPSTONE.md](DEMO_CAPSTONE.md). PRD ditambah FR46–FR53; gambar UML belum diedit.

## Bukti verifikasi lokal/integrasi

- Lint tanpa warning, TypeScript, 133 unit/route assertions di 16 file, dan build Next.js berhasil.
- 42 tes browser live API-mocked berhasil pada Chromium desktop + ponsel: tiga role, pelayanan pribadi, cancel/approval confirmation, readiness/publish payroll, CSRF/recovery/invitation, notifikasi, hari libur, keterlambatan 08:00:30 WIB, policy dan error/retry audit. Tes browser mock bukan pengganti integrasi database nyata.
- 84 pemeriksaan database berhasil sebelum dan setelah migration 0011: semua perubahan fixture dan audit dibatalkan menggunakan exception akhir transaksi. Termasuk quota reserve/release, RLS/privilege, manager own-only payroll, self-approval denial, HR fallback, calendar, stale correction/version conflict, notification read, anonymous denial, dan payroll immutable.
- Migration 0010/0011 additive diterapkan melalui dry-run + ledger checksum. Tidak menjalankan reset seed atau provisioning ulang.
- Login nyata Faisal/HR, Wilda/Manager, Jonatan/Karyawan pada build lokal dengan Supabase nyata diuji di desktop dan ponsel. /hr-policy, /me/payslips, corrections, notifications, cuti, audit dan payroll menghasilkan scope/status yang diharapkan. Manager/Employee mendapat 403 untuk audit; Manager tetap 403 untuk payroll administrasi. Tidak ditemukan JavaScript error atau overflow horizontal pada halaman baru.
- Manager fixture lama mempunyai dua slip terbit; /me/payslips mengembalikan hanya dua snapshot miliknya sendiri. Akun kelas baru belum punya slip, ditampilkan sebagai empty state, bukan gaji 0 yang dikarang.
- Smoke test integrasi hanya membaca data dan membuat/mengakhiri sesi Auth. Tidak membuat absensi/cuti/koreksi/payroll asli dan tidak mengganti password nyata.

## Integritas data setelah migrasi

47 karyawan aktif; 40 gaji pokok belum dikonfigurasi. Payroll terbit Oktober 2026 dan Desember 2026 tetap tujuh item masing-masing. Checksum runs `8e59798f89c9a9c6bb68ee5ab6267631`, items `c741d553d877fe4f340408d21be78384`, dan compensation `db83c083be3771337325b751f64286a5` tidak berubah. Default Senin–Jumat/08:00–17:00 dan quota12 tetap; hari presentasi tidak diaktifkan otomatis.

## Catatan pengujian

Percobaan pertama menjalankan suite live pada build offline sehingga tidak menemukan form NIM; diulang setelah build live eksplisit. Locator error audit awalnya juga menangkap announcer Next.js, diperbaiki dengan scope teks yang tepat. Keduanya bukan bukti kegagalan integrasi aplikasi. Request lokal nyata menggunakan URL canonical `http://localhost:5173`; host 127.0.0.1 ditolak oleh guard origin saat Next menormalisasi request ke localhost, tanpa melonggarkan CSRF.

CI memvalidasi ulang mode demo/live dan database PostgreSQL disposable. CD Vercel hanya mengirim SHA main yang telah lolos CI. Hasil setiap commit tersedia di [GitHub Actions](https://github.com/Jonatanarya/capstone_hris/actions); keberhasilan deployment dan smoke test URL produksi harus dikonfirmasi setelah workflow selesai, tidak diasumsikan dari build lokal.

Belum diuji/dikerjakan: perubahan password positif pada akun nyata (sengaja menjaga password demo), delivery email nyata, cetak PDF lintas browser, concurrency load stress, review draft-final, effective-dated payroll/prorata/resign, entitlement individual melalui UI, supervisor/delegasi bertingkat, dan pembaruan UML. Bukan sertifikasi keamanan/kepatuhan untuk produksi.
