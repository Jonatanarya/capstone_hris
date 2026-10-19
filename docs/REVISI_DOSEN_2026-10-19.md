# Revisi dosen — 19 Oktober 2026

Dokumen ini menggantikan pembagian tugas versi 11 Oktober 2026 jika bertentangan. Keputusan pengguna: tetap **Next.js + Vercel + Supabase**. Tidak ada migrasi ke Neon, penghapusan database, penggantian sandi, atau perubahan gaji/payroll historis.

## Peran dan alur

| Aktivitas | Admin HR | Manager | Karyawan |
| --- | --- | --- | --- |
| Data karyawan, departemen, jabatan, akun | Kelola organisasi | Baca anggota departemen | Profil sendiri |
| Presensi | Pantau organisasi; verifikasi koreksi selain milik sendiri | Pantau departemen | Presensi/koreksi sendiri |
| Cuti/izin/sakit | Putuskan pengajuan selain milik sendiri | Pantau departemen, tidak memutuskan | Ajukan/batalkan PENDING sendiri |
| Target bulanan | Baca target, tidak membuat/mengubah | Susun dan bagikan target anggota aktif departemen selain diri sendiri/Manager | Baca target dibagikan sendiri |
| Realisasi, bukti, final KPI | Isi dan terbitkan, bukan untuk diri sendiri | Baca/pantau; tidak mengubah penilaian | Baca hasil final sendiri |
| Rekap bulanan | Organisasi + ekspor sesuai filter | Departemen sendiri + ekspor sesuai filter | Tidak mengakses laporan kolektif |
| Tes pelamar fiktif | Baca/edit skor simulasi | Baca saja | Tidak tersedia |
| Payroll, kebijakan, audit | Kelola sesuai pengaman sebelumnya | Tidak mengelola payroll/gaji rekan | Tidak mengelola |
| Layanan pribadi | Data sendiri | Data sendiri | Data sendiri |

Manager bukan pengguna yang sepenuhnya tanpa aksi: ia tetap membuat target bulanan dan menggunakan layanan pribadi. Yang dipindahkan ke HR adalah pekerjaan administrasi, keputusan cuti, dan penilaian. Tidak ada self-approval atau self-assessment; pengajuan HR sendiri membutuhkan HR lain, bukan persetujuan otomatis. Akun HR lama tetap tersedia.

1. Manager memilih bulan dan anggota tim, mengisi indikator, target, satuan, arah, bobot total 100%, serta cara mengukur.
2. Simpan draf target, lalu bagikan dengan konfirmasi. Manager tidak mengisi realisasi, bukti, catatan penilaian, atau nilai.
3. Setelah berbagi, target/bobot/cara ukur terkunci di API dan RPC. Karyawan dapat melihat snapshot target tanpa hasil draf.
4. HR membuka kartu target yang sudah dibagikan, mengisi realisasi, bukti dan catatan, lalu menyimpan draf penilaian.
5. HR menerbitkan hasil final dengan konfirmasi dan pemeriksaan versi. Nilai berbobot dihitung server; jika ada review lama, penggantian memerlukan konfirmasi eksplisit. Final tetap terkunci.
6. Manager memantau KPI dan rekap departemen, karyawan melihat hasil final sendiri. KPI tidak otomatis mengubah gaji atau bonus.

Endpoint penilaian angka manual lama ditutup. Data penilaian historis tidak dihapus dan ditandai sebagai **Penilaian lama** pada rekap. KPI final menjadi sumber nilai baru agar tidak ada dua penilaian paralel.

## Nomor Induk Karyawan

Istilah NIM/NPM pada form login diganti menjadi **Nomor Induk Karyawan**. Nilai `employee_no` yang sudah tersimpan tetap dipakai agar 40 akun kelas tidak kehilangan akses; tidak ada reset kata sandi. Alias email akun lama tetap didukung oleh server. Nomor induk untuk karyawan baru harus unik, dan boleh menggunakan format seperti `EMP-0041`. Mengubah format semua nomor lama memerlukan pemetaan terpisah, bukan sekadar mengganti label.

## Rekap kinerja bulanan

Menu **Rekap bulanan** menampilkan nomor induk, nama, departemen, hari kerja berjalan, hadir, terlambat, cuti/izin/sakit disetujui, hari tanpa keterangan, belum absen keluar, koreksi menunggu, nilai dan status KPI. Pencarian/filter memengaruhi tabel, ringkasan, dan CSV yang sama; nama file menyertakan bulan.

- Kehadiran dihitung menurut kalender HR saat laporan dibuka, tanggal bergabung, dan tanggal Jakarta. Hadir sudah mencakup terlambat; keduanya tidak dijumlahkan sebagai dua hari.
- Hari mendatang tidak dihitung. Hari ini baru dianggap tanpa keterangan setelah jam kerja berakhir. Hari libur tidak menjadi ketidakhadiran.
- Cuti yang disetujui tidak dihitung lagi sebagai tanpa keterangan. Label tanpa keterangan berarti belum ada catatan, bukan sanksi disiplin otomatis.
- Nilai yang belum ada tampil **Belum dinilai**, bukan 0. Nilai 0 yang sah tetap masuk rata-rata. Rata-rata hanya memakai karyawan dengan nilai.
- Manager tidak bisa memperoleh laporan departemen lain dengan mengganti parameter browser. Laporan tidak mengandung gaji, kontak privat, atau password.
- Rekap merupakan tampilan data berjalan, bukan dokumen penutupan bulan immutable. Lingkup departemen/status dan kalender mengikuti data saat ini. Riwayat tanggal resign, pindah departemen, kalender efektif, dan snapshot rekap tertutup belum dimodelkan; laporan historis perlu dibaca dengan batasan ini.

## Tes pelamar

Migrasi menambah 20 nama fiktif terpisah dari daftar karyawan. Skor potensi, teknis dan wawancara berupa bilangan bulat 0–100; nilai awal diacak sekali ketika migrasi dijalankan, kemudian disimpan. Rata-rata tiga tes berbobot sama dan dibulatkan. Ambang 75 hanya label **Lulus simulasi**, bukan standar perusahaan/tes psikologi atau keputusan penerimaan.

HR dapat memperbarui skor dan catatan dengan pemeriksaan versi serta audit. Manager hanya membaca. Tidak ada penambahan akun, perubahan gaji, atau pengangkatan otomatis. Mode frontend lokal memakai fixture yang jelas dan perubahan hanya bertahan selama sesi.

## Pengujian dan penerapan

Migrasi `0014_lecturer_revision.sql` menambah modul pelamar/rekap dan mengganti otorisasi fungsi bisnis, tanpa me-reset data. Sebelum penerapan: dry-run rollback, regresi PostgreSQL, unit/API, lint/tipe, build dan uji browser desktop/ponsel. Jalur Manager → target dibagikan → HR → KPI final wajib diuji, termasuk upaya Manager menilai/memutuskan cuti yang harus ditolak. Payroll tetap diuji rollback-only agar tidak menerbitkan slip uji untuk akun kelas.

Perubahan hak akses tidak sepenuhnya kompatibel dengan aplikasi versi lama: setelah migrasi, aplikasi lama tidak dapat memfinalisasi KPI sebagai Manager. Jika perlu rollback operasional, gunakan migrasi perbaikan baru dan deployment yang sesuai; jangan reset database atau mengedit migrasi yang sudah diterapkan.
