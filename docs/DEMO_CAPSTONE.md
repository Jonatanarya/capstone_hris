# PeopleSpace — panduan demo Capstone 4E

Pembaruan 11 Oktober 2026. Ini HRIS untuk demonstrasi akademik, bukan sistem penggajian perusahaan produksi. Mode live menyimpan data di Supabase; label “demo” menerangkan tujuan penggunaan, bukan berarti semua data dihapus saat refresh.

## Pembagian role dan layanan pribadi

| Aksi | HR (Faisal) | Manager (Wilda) | Karyawan |
| --- | --- | --- | --- |
| Profil/kontak, absensi, cuti pribadi | Milik sendiri | Milik sendiri | Milik sendiri |
| Slip pribadi terbit, koreksi absensi, password opsional | Milik sendiri | Milik sendiri | Milik sendiri |
| Direktori/absensi/penilaian | Organisasi | Departemen sendiri | Data sendiri |
| KPI bulanan | Monitor draf/final organisasi | Susun/isi/final anggota departemen selain diri sendiri | Baca hasil final sendiri |
| Keputusan cuti | Pengajuan Manager atau departemen tanpa Manager aktif | Anggota departemen selain diri sendiri dan Manager | Tidak |
| Keputusan koreksi absensi | Karyawan aktif, selain diri sendiri | Tidak | Tidak |
| Gaji/master/akun, kebijakan, audit, laporan organisasi | Ya | Tidak | Tidak |

Tim demo memakai departemen Demo Kelas 4E. Supervisor bertingkat, delegasi, dan lintas departemen belum diperlukan: scope Manager tetap departemen. HR dengan departemen yang memiliki Manager dapat mengajukan cuti kepada Manager; HR di departemen tanpa Manager membutuhkan HR lain, tidak boleh menyetujui diri sendiri. Akun HR lama tidak dihapus sehingga penguji kedua tetap tersedia.

## Urutan presentasi

1. HR masuk memakai akun yang sudah disediakan. Tunjukkan direktori, role, dan profil. Gunakan akun karyawan yang berbeda untuk alur persetujuan.
2. Periksa **Kebijakan HR**. Jika presentasi pada Sabtu/Minggu, HR dapat memasukkan hari tersebut sebagai hari kerja melalui form dan konfirmasi. Jangan mengubah jam server atau memalsukan tanggal. Kembalikan kebijakan setelah selesai bila diinginkan.
3. Karyawan masuk → Absensi → absen masuk. “Terlambat” dihitung server termasuk detik dan menyimpan kebijakan saat absen. Hari libur atau tanggal cuti/izin/sakit disetujui tidak bisa check-in; check-out untuk catatan yang sudah dimulai tetap tersedia.
4. Karyawan → Pengajuan cuti → pilih hari kerja **yang belum memiliki absensi**. Manager → Pengajuan cuti → Setujui → konfirmasi. Tunjukkan nama peninjau, status, dan notifikasi karyawan. Manager sendiri mengajukan cuti ke HR, bukan menyetujui sendiri.
5. Ajukan cuti lain yang masih menunggu → Batalkan pengajuan → konfirmasi. Status menjadi Dibatalkan, catatan tidak dihapus, saldo reservasi tahunan kembali. Cuti disetujui/ditolak tidak dapat dibatalkan langsung; gunakan data/tanggal lain untuk demo.
6. Layanan pribadi → koreksi absensi tanggal kerja dalam 30 hari terakhir. Pengajuan tidak langsung mengubah absensi. HR lain meninjau jam/alasan, memasukkan catatan keputusan dan konfirmasi. Versi absensi berubah sejak pengajuan menyebabkan konflik, bukan overwrite diam-diam.
7. HR → data karyawan → lengkapi **gaji pokok contoh** secara eksplisit. Nominal baru tidak diisi otomatis karena belum ada arahan nilai. Semua karyawan aktif yang masuk draft harus lengkap agar payroll bisa diterbitkan. Nilai 0 berarti belum dikonfigurasi.
8. HR → Payroll → pilih bulan → buat draft → periksa komponen dan readiness → sinkronkan bila master berubah → terbitkan dengan konfirmasi. Karyawan/Manager/HR → Layanan pribadi → slip gaji sendiri setelah terbit. Anggota kelas baru tidak otomatis dimasukkan ke payroll historis yang sudah terbit. Payroll tidak mengirim uang.
9. Manager → KPI → pilih bulan → Susun KPI → pilih anggota aktif → sesuaikan indikator, target, arah, satuan, bobot total 100% → isi realisasi → Simpan draf KPI → Tutup editor → Terbitkan KPI → konfirmasi. Karyawan → KPI membaca hasil final sendiri. HR memantau hasil organisasi. Nilai final otomatis menjadi nilai Penilaian kinerja; penilaian manual lama diganti hanya setelah konfirmasi/version check, lalu terkunci untuk periode itu. Penilaian manual tetap tersedia bila belum ada KPI final. Tidak ada penilaian diri sendiri.
10. HR → Riwayat aktivitas: perubahan tercatat, hanya baca. Tunjukkan notifikasi belum dibaca/dibaca yang bertahan setelah muat ulang.

Password NIM dipertahankan untuk kemudahan demo. Form ganti password pribadi opsional memerlukan password saat ini, konfirmasi password baru, dan masuk ulang. Jangan mencoba ganti password seluruh kelompok saat presentasi. Alias @example.test bukan inbox; pemulihan melalui email hanya untuk alamat email sungguhan. Pemulihan massal/akun terlupa memerlukan tindakan pemilik proyek secara eksplisit, bukan endpoint reset anonim berbasis NIM.

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
| PUT /kpis | Manager; employeeId/period/indicators/notes/expectedVersion; null version untuk draf baru |
| POST /kpis/{id}/publish | Manager; expectedVersion dan expectedReviewVersion (null jika review belum ada); nilai dihitung server |

Manager tetap mendapat 403 pada API administrasi payroll. RLS memberi akses hanya ke **item terbit miliknya sendiri**, bukan gaji kolega. Mutasi bisnis memakai RPC terotorisasi, bukan service-role bypass. Semua mutasi browser melewati same-origin/CSRF check yang sudah ada.

## Migrasi, tes, dan batas lingkup

Migrasi additive 0010 menambah enum CANCELLED; harus commit sebelum 0011 memakai nilai itu. Migrasi 0011 menambah kalender, cancellation timestamp, fungsi persetujuan/fallback, layanan pribadi, koreksi, read receipt dan audit read. Tidak mereset password, salary, daftar karyawan, maupun payroll terbit. Jalankan dry-run dan regresi rollback-only sebelum penerapan; jangan mengubah file migrasi yang sudah diterapkan.

Tes unit memeriksa input/role/password/scoping dan keterlambatan 30 detik. Regresi database menguji hak akses, quota, cancellation, immutability, fallback, koreksi dan notifikasi dalam transaksi yang selalu rollback. Browser tes memakai API mock pada desktop/ponsel; smoke test deployment memakai login nyata dan pembacaan data tanpa membuat cuti/absensi/payroll asli. Penggantian password nyata tidak dijalankan otomatis pada akun demo. Bukti hasil terakhir ada pada Actions dan catatan akhir audit.

Lingkup lanjutan yang sengaja ditunda: struktur supervisor/delegasi bertingkat, pembatalan cuti disetujui dengan persetujuan baru, KPI otomatis dari metrik operasional/kalibrasi lintas penilai, entitlement individual lewat UI, histori gaji/tanggal resign serta prorata otomatis, GPS/fingerprint, rekrutmen, pajak/BPJS dan transfer bank, email/push notification, audit compliance dan backup recovery drill. Diagram UML akademik masih perlu diselaraskan dengan FR46–FR54; dokumen ini tidak mengklaim gambar UML lama sudah diperbarui.

## KPI demo dan contoh hitungan

Migrasi additive 0012 menambah kpi_assessments dan provenance kpi_id pada performance_reviews, RLS, RPC save/publish, serta penguncian penilaian manual setelah final. Tidak membuat nilai asli atau mereset data.

Contoh: penyelesaian tugas target 100%, bobot 50%, realisasi 80%; kualitas target 100%, bobot 30%, realisasi 90%; ketepatan waktu target 100%, bobot 20%, realisasi 100%. Nilai final = 80×50% + 90×30% + 100×20% = **87 (Baik)**. Untuk indikator jumlah kesalahan, pilih lebih rendah lebih baik dan target positif; realisasi 0 mendapat capaian 100%. Semua capaian dibatasi 100%, lalu total dibulatkan. Kosong berarti belum dinilai, berbeda dari realisasi nol. Template awal hanya contoh target dan dapat diubah; realisasi tidak diisi otomatis.

Draf tidak terlihat oleh Karyawan. KPI final immutable dan penerbitan ulang ditolak. Tidak ada tombol hapus/reset untuk menghilangkan histori final. Koreksi final memerlukan keputusan kelompok dan migrasi/alur khusus, bukan overwrite lewat penilaian manual. KPI tidak otomatis mengubah gaji/bonus. Notifikasi menggunakan event penilaian kinerja pribadi yang telah tersedia.
