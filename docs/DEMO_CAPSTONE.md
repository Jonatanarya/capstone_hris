# PeopleSpace — panduan demo Capstone 4E

Pembaruan 19 Oktober 2026. Ini HRIS untuk demonstrasi akademik, bukan sistem penggajian perusahaan produksi. Mode live tetap memakai Supabase. [Revisi dosen](REVISI_DOSEN_2026-10-19.md) menjadi acuan terbaru; label “demo” tidak berarti data live dihapus saat refresh.

## Pembagian role dan layanan pribadi

| Aksi | HR (Faisal) | Manager (Wilda) | Karyawan |
| --- | --- | --- | --- |
| Profil/kontak, absensi, cuti pribadi | Milik sendiri | Milik sendiri | Milik sendiri |
| Slip pribadi terbit, koreksi absensi, password opsional | Milik sendiri | Milik sendiri | Milik sendiri |
| Direktori/absensi/penilaian | Organisasi | Departemen sendiri | Data sendiri |
| KPI bulanan | Isi realisasi/bukti dan final berdasarkan target dibagikan, selain milik sendiri | Susun/bagikan target anggota departemen; pantau hasil, bukan menilai | Baca target dibagikan dan final sendiri |
| Keputusan cuti | Semua pengajuan selain milik sendiri | Pantau saja | Tidak |
| Rekap bulanan | Organisasi + CSV | Departemen sendiri + CSV | Tidak |
| Tes pelamar fiktif | Baca/edit skor simulasi | Baca saja | Tidak |
| Keputusan koreksi absensi | Karyawan aktif, selain diri sendiri | Tidak | Tidak |
| Gaji/master/akun, kebijakan, audit, laporan organisasi | Ya | Tidak | Tidak |

Tim demo memakai departemen Demo Kelas 4E. Scope Manager tetap departemen. HR yang mengajukan cuti atau membutuhkan penilaian sendiri memerlukan HR lain, tidak boleh menyetujui/menilai diri sendiri. Akun HR lama tidak dihapus sehingga penguji kedua tetap tersedia.

## Urutan presentasi

1. HR masuk memakai akun yang sudah disediakan. Tunjukkan direktori, role, dan profil. Gunakan akun karyawan yang berbeda untuk alur persetujuan.
2. Periksa **Kebijakan HR**. Jika presentasi pada Sabtu/Minggu, HR dapat memasukkan hari tersebut sebagai hari kerja melalui form dan konfirmasi. Jangan mengubah jam server atau memalsukan tanggal. Kembalikan kebijakan setelah selesai bila diinginkan.
3. Karyawan masuk → Absensi → absen masuk. “Terlambat” dihitung server termasuk detik dan menyimpan kebijakan saat absen. Hari libur atau tanggal cuti/izin/sakit disetujui tidak bisa check-in; check-out untuk catatan yang sudah dimulai tetap tersedia.
4. Karyawan → Pengajuan cuti → pilih hari kerja **yang belum memiliki absensi**. HR → Pengajuan cuti → Setujui → konfirmasi. Tunjukkan nama peninjau, status, dan notifikasi karyawan. Manager hanya memantau pengajuan tim; pengajuan pribadinya juga ke HR.
5. Ajukan cuti lain yang masih menunggu → Batalkan pengajuan → konfirmasi. Status menjadi Dibatalkan, catatan tidak dihapus, saldo reservasi tahunan kembali. Cuti disetujui/ditolak tidak dapat dibatalkan langsung; gunakan data/tanggal lain untuk demo.
6. Layanan pribadi → koreksi absensi tanggal kerja dalam 30 hari terakhir. Pengajuan tidak langsung mengubah absensi. HR lain meninjau jam/alasan, memasukkan catatan keputusan dan konfirmasi. Versi absensi berubah sejak pengajuan menyebabkan konflik, bukan overwrite diam-diam.
7. HR → data karyawan → periksa gaji pokok contoh. Tepat 40 akun kelas sudah diisi Rp3.000.000/bulan sesuai persetujuan pengguna; bukan gaji nyata. Gaji akun lama tidak diubah. Semua anggota roster aktif harus lengkap sebelum payroll terbit; nilai 0 berarti belum dikonfigurasi.
8. HR → Payroll → pilih bulan → buat draft → periksa komponen dan readiness → sinkronkan bila master berubah → terbitkan dengan konfirmasi. Karyawan/Manager/HR → Layanan pribadi → slip gaji sendiri setelah terbit. Anggota kelas baru tidak otomatis dimasukkan ke payroll historis yang sudah terbit. Payroll tidak mengirim uang.
9. Manager → KPI → pilih bulan → Susun target bulanan → anggota aktif → indikator/target/arah/satuan/bobot 100% dan cara ukur → Simpan draf target → Bagikan target → konfirmasi. Karyawan melihat target tanpa nilai draf. Beralih HR → KPI → Isi realisasi KPI → lengkapi realisasi/bukti → Simpan draf KPI → Terbitkan KPI → konfirmasi. Target terkunci; Manager tidak mengisi nilai. Final menjadi Penilaian kinerja; review lama diganti dengan konfirmasi/version check. Tidak ada self-assessment atau perubahan gaji otomatis.
10. HR → Riwayat aktivitas: perubahan tercatat, hanya baca. Tunjukkan notifikasi belum dibaca/dibaca yang bertahan setelah muat ulang.
11. HR/Manager → Rekap bulanan → pilih bulan → cari/filter karyawan → lihat kehadiran dan nilai → Unduh rekap CSV. Manager hanya menerima data departemennya. Belum dinilai bukan nol; hadir termasuk terlambat.
12. HR/Manager → Tes pelamar → tunjukkan label Data Dummy, skor dan rata-rata. HR dapat edit skor dengan validasi 0–100; Manager tidak memiliki kontrol edit. Ini tidak membuat akun/karyawan baru.

Label login sekarang Nomor Induk Karyawan. Angka nomor akun dan password demo yang sudah ada tetap dipertahankan. Form ganti password opsional memerlukan password saat ini, konfirmasi dan masuk ulang. Alias @example.test bukan inbox; pemulihan email hanya untuk alamat email sungguhan. Tidak ada reset anonim berdasarkan nomor induk.

## Status dan integritas

- Cuti: PENDING → APPROVED / REJECTED, atau PENDING → CANCELLED oleh pemilik. Semua role boleh mengajukan, tidak ada self-approval. Sakit boleh mundur sesuai batas kebijakan (default 7 hari); izin/tahunan tidak boleh mundur. Durasi memakai hari kerja dan tanggal libur; durasi/policy snapshot pengajuan lama tidak dihitung ulang dari kebijakan baru.
- Koreksi: PENDING → APPROVED / REJECTED oleh HR selain pemilik. Alasan dan keputusan tersimpan; hari libur/cuti disetujui tidak dapat diberi absensi lewat koreksi. Jam tidak boleh di masa depan; check-out tidak boleh mendahului check-in. Koreksi yang ditolak tidak menyentuh catatan asli.
- Payroll: DRAFT → PUBLISHED, tidak dapat diedit setelah terbit. Draft menggunakan roster aktif saat diproses, bukan histori kepegawaian periodik atau prorata. Riwayat tanggal resign/effective salary belum dibuat; gunakan periode demo yang cocok dengan roster saat ini. Jangan pakai aplikasi ini untuk menentukan kewajiban gaji nyata.
- Nonaktif: HR harus mengonfirmasi penonaktifan di form. Akses aplikasi karyawan tidak aktif ditolak; catatan lama tetap ada. Akun HR sendiri/HR aktif terakhir tetap terlindungi.
- Notifikasi: pengajuan yang perlu keputusan, keputusan cuti/koreksi pribadi, slip terbit, dan review pribadi. Bukan semua histori pengajuan. Maksimum 200 event terbaru; read receipt di database per pengguna. Pending request tidak hilang hanya karena dibaca.
- Chart live: absensi tercatat tujuh hari terakhir dibagi jumlah anggota aktif saat ini. Bukan histori headcount atau angka ilustrasi. Jika API gagal, tampilkan error/retry; jangan mengganti data live dengan fixture.

## API tambahan

| API | Scope |
| --- | --- |
| GET /hr-policy | Akun aktif, aturan kalender/jam |
| PATCH /hr-policy | HR, expectedVersion dan konfirmasi UI |
| POST /leave-requests/{id}/cancel | Pemilik, hanya PENDING, expectedVersion |
| GET /me/payslips | Semua role, hanya sendiri dan PUBLISHED |
| PATCH /me/password | Akun aktif, verifikasi password saat ini; tidak menerima userId/employeeId |
| GET/POST /attendance-corrections | HR membaca organisasi, role lain sendiri; pengajuan selalu sendiri |
| POST /attendance-corrections/{id}/decision | HR, bukan pemilik, expectedVersion, catatan wajib |
| GET/PATCH /notifications | Event yang relevan/read receipt milik akun login |
| GET /audit-log?page=N&pageSize=50 | HR saja, tanpa password/token/raw metadata |
| GET /kpis?period=YYYY-MM | HR organisasi; Manager departemen + hasil final sendiri; Karyawan final sendiri |
| GET /kpis/targets | Manager: anggota aktif tim selain Manager/diri sendiri; HR: karyawan aktif selain diri sendiri |
| GET /kpi-goals?period=YYYY-MM | Snapshot target aman; pemilik dapat membaca sebelum final, tanpa realisasi/bukti/catatan |
| PUT /kpis | Manager: hanya target belum dibagikan, tanpa realisasi/bukti/catatan penilaian. HR: realisasi/bukti setelah target dibagikan; versi wajib untuk perubahan |
| POST /kpis/{id}/share-goals | Manager tim; expectedVersion; cara ukur wajib; snapshot aman/notifikasi pemilik |
| POST /kpis/{id}/publish | HR saja; expectedVersion dan expectedReviewVersion; target dibagikan, realisasi/bukti lengkap; nilai server |
| GET /monthly-performance?period=YYYY-MM | HR organisasi; Manager departemen; Karyawan 403 |
| GET /applicants | HR dan Manager; hanya data simulasi |
| PATCH /applicants/{id} | HR saja; skor integer 0–100, catatan, expectedVersion; audited |
| PUT /employees/{id}/performance-reviews/{period} | Ditutup: gunakan finalisasi KPI, histori lama tetap tersedia |

Manager tetap mendapat 403 pada API administrasi payroll. RLS memberi akses hanya ke **item terbit miliknya sendiri**, bukan gaji kolega. Mutasi bisnis memakai RPC terotorisasi, bukan service-role bypass. Semua mutasi browser melewati same-origin/CSRF check yang sudah ada.

## Migrasi, tes, dan batas lingkup

Migrasi additive 0010 menambah enum CANCELLED; harus commit sebelum 0011 memakai nilai itu. Migrasi 0011 menambah kalender, cancellation timestamp, fungsi persetujuan/fallback, layanan pribadi, koreksi, read receipt dan audit read. Tidak mereset password, salary, daftar karyawan, maupun payroll terbit. Jalankan dry-run dan regresi rollback-only sebelum penerapan; jangan mengubah file migrasi yang sudah diterapkan.

Tes unit memeriksa input/role/password/scoping dan keterlambatan 30 detik. Regresi database menguji hak akses, quota, cancellation, immutability, fallback, koreksi dan notifikasi dalam transaksi yang selalu rollback. Browser tes memakai API mock pada desktop/ponsel; smoke test deployment memakai login nyata dan pembacaan data tanpa membuat cuti/absensi/payroll asli. Penggantian password nyata tidak dijalankan otomatis pada akun demo. Bukti hasil terakhir ada pada Actions dan catatan akhir audit.

Lingkup lanjutan: supervisor/delegasi bertingkat, pembatalan cuti disetujui, KPI dari metrik operasional/kalibrasi, entitlement individual lewat UI, histori gaji/resign/prorata, GPS/fingerprint, rekrutmen, pajak/BPJS/transfer bank, email/push, audit compliance dan backup recovery drill. Paket UML revisi FR46–FR56 tersedia di docs/UML; file PowerDesigner lama tidak ditimpa.

## KPI demo dan contoh hitungan

Migrasi additive 0012 menambah kpi_assessments dan provenance kpi_id pada performance_reviews, RLS, RPC save/publish, serta penguncian penilaian manual setelah final. Tidak membuat nilai asli atau mereset data.

Contoh: penyelesaian tugas target 100%, bobot 50%, realisasi 80%; kualitas target 100%, bobot 30%, realisasi 90%; ketepatan waktu target 100%, bobot 20%, realisasi 100%. Nilai final = 80×50% + 90×30% + 100×20% = **87 (Baik)**. Untuk indikator jumlah kesalahan, pilih lebih rendah lebih baik dan target positif; realisasi 0 mendapat capaian 100%. Semua capaian dibatasi 100%, lalu total dibulatkan. Kosong berarti belum dinilai, berbeda dari realisasi nol. Template awal hanya contoh target dan dapat diubah; realisasi tidak diisi otomatis.

Draf evaluasi tidak terlihat oleh karyawan pemilik. Target dibagikan tersimpan di kpi_goal_plans, tanpa actual/evidence/notes/score, dan memicu notifikasi. Migrasi additive 0014 membagi tugas Manager perencana dan HR penilai, memindahkan keputusan cuti ke HR, serta menambah rekap/pelamar. Manager dapat memantau draf tim sebagai pembaca, tetapi tidak mengubah realisasi atau menerbitkannya. Final immutable; simpan gagal mempertahankan editor dan simpan sukses menutupnya.

## Gladi bersih terpisah

Gunakan departemen **UAT Capstone 2026-10-11** dan tiga akun berlabel [UAT], bukan 40 akun kelas. Kredensial uji dibuat privat dan tidak disimpan dalam Git. Periode KPI uji: 2099-01; cuti uji memakai tanggal kerja masa depan, koreksi memakai tanggal kerja 30 hari terakhir. Cuti, koreksi, target, dan final KPI disimpan sebagai bukti dengan alasan [UAT], bukan dihapus setelah tes. Pengujian password hanya akun UAT dan dikembalikan ke password privat semula; akun kelas tidak diubah.

Payroll global selalu memakai seluruh roster aktif, bukan satu departemen. Tanpa izin terpisah, penerbitan payroll diuji dalam transaksi database rollback-only, sehingga tidak membuat slip uji bagi akun kelas. Browser mock menguji dialog/readiness/slip; tes rollback menguji transaksi nyata. Jangan menyebut kombinasi ini sebagai payroll live end-to-end penuh.
