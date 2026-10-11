# Penyempurnaan demo HRIS - 11 Oktober 2026

## Perubahan

- Gaji pokok contoh Rp3.000.000/bulan diterapkan melalui RPC HR dengan expectedVersion untuk tepat 40 NIM whitelist kelas, sesuai jawaban pengguna. Akun lama di luar daftar, password, role, dan payroll terbit tidak diubah. Verifikasi setelah mutasi: 40/40 cocok; kompensasi nonkelas dan checksum payroll tetap.
- Migrasi additive 0013: snapshot kpi_goal_plans aman terpisah dari draf evaluasi; realisasi/bukti/notes/score tidak masuk snapshot. Target, bobot dan cara mengukur terkunci setelah dibagikan. Read receipt/notifikasi tetap privat.
- Penilai KPI: Manager untuk anggota aktif departemen selain diri sendiri/Manager; HR untuk Manager aktif selain diri sendiri. Daftar target berasal dari RPC server, bukan tebakan direktori frontend. Final dihitung database dan memperbarui performance review serta assessor/kpi_id secara atomik.
- Cara ukur maksimal 1000 karakter wajib saat berbagi; bukti realisasi teks maksimal 1000 karakter wajib saat final. Tidak ada upload berkas atau skor kelas otomatis. Simpan sukses menutup editor, kegagalan tidak membuang input.
- PRD root proyek dan salinan Git diselaraskan; perbedaan hanya tautan relatif. Panduan demo, handoff dan rollback diperbarui. Laporan UML v3 12 halaman dibuat sebagai PDF vektor dengan sampul identitas kelompok; seluruh halaman dirender dan diperiksa. PowerDesigner/PDF asli tetap arsip.

## Verifikasi dan pemisahan data

Quality gate: lint tanpa warning, TypeScript, 158 unit/route assertions, 128 regresi database rollback-only, build demo/live, 12 browser demo serta 54 browser live-mock pada desktop/ponsel. Audit dependensi production: 0 vulnerabilities pada saat pengujian. Hasil ini tidak menggantikan audit keamanan menyeluruh.

Gladi bersih menggunakan tiga akun [UAT] pada departemen UAT Capstone 2026-10-11, bukan akun kelas. Melalui Next.js API + sesi Supabase nyata: 5 skenario cuti (approve/reject/cancel, Manager ke HR, HR pribadi ke Manager), 1 koreksi absensi, KPI Karyawan oleh Manager (87), KPI Manager oleh HR (94), notifikasi, dan UI final tiga role di dua viewport. Nilai ini sintetis khusus UAT, bukan kinerja mahasiswa. Password UAT Karyawan diuji dengan password salah, ganti, login lama ditolak, login baru, dan pemulihan password privat semula; password kelas tidak disentuh.

Periode **KPI** UAT 2099-01 berarti Januari 2099 sebagai penanda sintetis, bukan tahun penggajian kelas. Data UAT dipertahankan dengan label/alasan [UAT]. Akun/credential/receipt rinci ada pada folder work privat yang diabaikan Git, tidak disertakan pada laporan publik.

Payroll live tidak diterbitkan selama gladi bersih. Publikasi diuji dalam transaksi nyata yang rollback dan browser mock; belum diklaim sebagai payroll live end-to-end penuh. Dua payroll historis tetap PUBLISHED (2026-10 dan 2026-12), masing-masing 7 item; checksum run `8e59798f89c9a9c6bb68ee5ab6267631` dan item `c741d553d877fe4f340408d21be78384` sama sebelum/sesudah. Setelah salary dan tiga akun UAT: 50 karyawan aktif, 0 gaji aktif belum dikonfigurasi.

## Rilis dan batas tersisa

Perubahan dikirim melalui main; CI demo/live dan PostgreSQL terisolasi menjadi gerbang sebelum Deploy Vercel mengambil SHA yang telah diuji. Migrasi 0013 didry-run/regresi sebelum diterapkan terpisah melalui ledger; CD aplikasi tidak melakukan reset DB. Verifikasi deployment memakai login/pembacaan role nyata tanpa menyunting transaksi akun kelas. Hasil pipeline final tersedia di GitHub Actions pada commit rilis.

Masih ditunda: transfer bank/pajak/BPJS, effective salary/resign/prorata, supervisor/delegasi, pembatalan cuti disetujui, revisi formal KPI final, metrik KPI operasional otomatis/kalibrasi, GPS/fingerprint, backup recovery drill, audit kepatuhan. Tidak memerlukan perluasan itu untuk demo mata kuliah ini.
