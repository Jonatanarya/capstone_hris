# Audit full-stack PeopleSpace — 7 Oktober 2026

## Kesimpulan

Frontend, backend Supabase, dan deployment Vercel **sudah terintegrasi**. Namun sistem **belum layak memakai data HR/gaji nyata**: masih ada celah otorisasi langsung Supabase, race pengajuan cuti, risiko admin terkunci, dan pembacaan gaji yang salah. Status hijau CI saat ini terutama membuktikan frontend demo, bukan seluruh backend produksi.

Audit dilakukan terhadap checkout `0f1f85c62e9b58cf5727e5e24d4268a5e2833cd1`, situs [PeopleSpace produksi](https://peoplespace-hris.vercel.app), dan project Supabase yang dikonfigurasi pada checkout ini. Tidak ada perbaikan aplikasi, migration, reset database, perubahan password, undangan email, atau deployment baru yang dilakukan dalam audit ini.

## 1. Hasil yang benar-benar dijalankan

| Pemeriksaan                                                | Hasil                                     | Batas cakupan                                                                              |
| ---------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| Lint yang didefinisikan proyek                             | Lulus tanpa warning                       | Script npm belum mencakup semua file backend                                               |
| Lint tambahan API, helper Supabase, adapter, client, proxy | Lulus tanpa warning                       | Dijalankan terpisah karena belum masuk CI                                                  |
| TypeScript                                                 | Lulus                                     | Bukan pembuktian aturan akses/runtime database                                             |
| Unit test                                                  | **32/32 lulus**                           | Empat berkas; terutama aturan demo, mode, adapter dan client                               |
| Build Next.js produksi                                     | Lulus                                     | Seluruh route handler dan proxy terkompilasi                                               |
| Playwright desktop + ponsel                                | **12/12 lulus**                           | Build lokal memakai mode **demo**, bukan live Supabase                                     |
| Audit dependensi production                                | **0 vulnerabilities**                     | Hasil saat pemeriksaan, bukan jaminan keamanan aplikasi menyeluruh                         |
| Koneksi Supabase                                           | Lulus                                     | URL/key berfungsi; nilai key tidak dicetak/disalin ke laporan                              |
| HTTP produksi tambahan                                     | **79/88 lulus, 9 gagal**                  | Login tujuh fixture, endpoint baca lintas peran, ekspor dan invalid input                  |
| Akses langsung Supabase/RLS tambahan                       | **20/24 lulus, 4 gagal**                  | Akun aktif, inactive, DISABLED, INVITED dan anon                                           |
| Transaksi database tambahan                                | **7/11 lulus, 4 gagal**                   | Termasuk create employee, cuti/keputusan, payroll dan penilaian; seluruh tulis di-rollback |
| Probe tambahan business/security/concurrency               | **11/18 lulus, 7 gagal**                  | Presensi, validasi cuti, null version, target review, snapshot, private schema dan race    |
| Browser live pada ukuran 390 × 844                         | 11 modul terbuka, tidak ada page overflow | Tabel memakai scroll horizontal; bukan audit WCAG/seluruh browser                          |

Empat kelompok tes tambahan berjumlah **141 assertion: 117 lulus, 24 gagal**. Beberapa assertion gagal menguji masalah yang sama melalui jalur berbeda; angka tersebut bukan jumlah bug unik. Ekspektasi akses mengikuti PRD/kontrak handoff saat ini. Jika kebijakan role berubah, revisi kontrak, UI dan tes bersama.

Percobaan HTTP pertama terinterferensi logout global dari tes RLS yang berjalan bersamaan. Hasil tersebut **tidak dipakai**. Angka HTTP di atas berasal dari pengulangan tanpa tes login/logout lain yang berjalan paralel. Identitas fixture RLS juga diselesaikan dari profil Auth, bukan asumsi ID.

CI [37509409164](https://github.com/Jonatanarya/capstone_hris/actions/runs/37509409164) dan deployment [37509702449](https://github.com/Jonatanarya/capstone_hris/actions/runs/37509702449) untuk SHA checkout tersebut sukses. Situs live merespons 200 dan API melayani data Supabase. Audit ini tidak memicu workflow baru.

## 2. Temuan prioritas P1 — sebelum data HR asli

### P1-01 — Gaji detail HR menjadi nol; form edit tidak memuat detail lengkap

**Bukti live:** GET detail karyawan HR mengembalikan `compensation.baseSalaryIdr = 0`, padahal pembacaan database membuktikan gaji fixture tersebut positif. Query admin `.from('employee_compensation')` gagal `PGRST205`; tabel sebenarnya berada pada schema `private`, bukan `public`.

**Bukti browser:** form edit Rizky menampilkan gaji `0`, telepon dan alamat kosong. Direktori memuat EmployeeSummary tanpa kontak/gaji, lalu langsung digunakan sebagai data form. Tidak ada pemanggilan detail employee ketika membuka form. Save mengirim kembali salary/phone/address; jika pengguna melengkapi field kosong tanpa menyadari gaji nol, ada risiko menimpa data sebenarnya. Tidak ada form yang disimpan selama audit.

Acuan: `app/api/v1/employees/[id]/route.ts:41`, `lib/api/dto.ts:53`, `app/hris-app.tsx:909`, `app/hris-app.tsx:740`, `lib/api-adapters.ts:67`.

Perbaikan: proyeksi/RPC HR yang aman untuk kompensasi private, jangan mengubah schema private menjadi publik hanya untuk menyelesaikan error; wajib menangani error query. Muat EmployeeAdmin sebelum membuka edit, tampilkan loading/error, jangan memakai nilai nol untuk field yang belum berhasil dibaca.

### P1-02 — Pengajuan cuti belum aman terhadap permintaan bersamaan

**Bukti database:** dua transaksi paralel untuk karyawan/tanggal cuti tahunan yang sama masing-masing berhasil mencapai tahap insert, ketika transaksi pertama masih menahan insert sebelum rollback. Kedua probe berjalan bersamaan sekitar 3,9 detik. Tidak ada record uji yang akhirnya disimpan.

`create_leave_request` membaca bentrok dan kuota sebelum insert tanpa lock per karyawan/tahun dan tanpa exclusion constraint overlap. Keduanya dapat membaca keadaan awal yang sama. Tes ini membuktikan admission paralel diterima, **bukan** bahwa audit telah menyimpan kelebihan kuota di produksi.

Acuan: `supabase/migrations/0003_rpc.sql:236`.

Perbaikan: serialisasi pengajuan dengan lock yang konsisten, hitung ulang saldo/bentrok setelah lock, dan pertahanan constraint yang sesuai. Tambahkan tes dua pengajuan bertabrakan/kuota terakhir pada database uji terisolasi.

### P1-03 — API dan RLS/RPC mempunyai aturan akses berbeda

**Bukti live langsung Supabase:**

- Manager ditolak API payroll dengan 403, tetapi SELECT `payroll_items` langsung mengembalikan **dua item published miliknya**. Kontrak saat ini melarang seluruh payroll Manager, termasuk own.
- Akun employee inactive, DISABLED dan INVITED tidak melihat direktori, tetapi ketiganya tetap dapat memanggil `leave_balance` untuk identitas sendiri.
- Dalam transaksi rollback, Manager dapat memanggil `create_leave_request`, walaupun API/UI membatasi pengajuan ke EMPLOYEE.
- UPDATE kontak sendiri langsung ke tabel diterima; UPDATE employee oleh HR langsung juga diterima. Jalur ini melewati aturan RPC-only dan audit/aggregate version yang dirancang pada kontrak.

Acuan: `supabase/migrations/0005_tighten_active.sql:54`, `supabase/migrations/0005_tighten_active.sql:65`, `supabase/migrations/0003_rpc.sql:19`, `supabase/migrations/0003_rpc.sql:249`, `supabase/migrations/0002_security.sql:107`.

Metadata deployed menunjukkan authenticated juga masih memiliki privilege TRUNCATE/TRIGGER/REFERENCES pada tabel public. **Tidak ada TRUNCATE/DELETE yang dicoba**, dan keberadaan grant tersebut tidak otomatis membuktikan endpoint REST dapat menjalankan TRUNCATE. Tetap cabut hak yang tidak diperlukan dan periksa default privileges.

Perbaikan: samakan pemeriksaan role/status pada API, RLS dan setiap RPC elevated; persempit grants; jangan bergantung pada tombol tersembunyi atau handler Next.js saja. Dasar mekanisme: [Supabase RLS dan grants](https://supabase.com/docs/guides/database/postgres/row-level-security).

### P1-04 — HR dapat menonaktifkan employee sendiri dan mengunci akses admin

**Bukti database rollback:** `update_employee` menerima employment status INACTIVE untuk employee HR aktif yang sedang memanggil fungsi. Fungsi tidak menjaga invariant self/last-active-HR. Setelah perubahan nyata, `is_active_actor()` akan false dan fungsi administratif berikutnya tidak dapat diakses akun tersebut. Perlindungan di `update_account` tidak cukup untuk jalur employees/direct table writes.

Acuan: `supabase/migrations/0003_rpc.sql:96`, `supabase/migrations/0002_security.sql:107`.

Perbaikan: enforce invariant pada semua jalur perubahan status/role/employee, dengan lock global yang relevan; bootstrap/recovery admin harus mempunyai prosedur tepercaya.

### P1-05 — Kredensial demo publik masih dapat login sebagai HR produksi

**Bukti:** akun fixture HR berhasil login memakai password demo yang tercantum pada repository publik. Laporan ini sengaja tidak menyalin password atau token. Ini dapat diterima hanya sebagai demo akademik dengan data fiktif dan akses yang sengaja terbuka, bukan sebagai sistem HR privat.

Perbaikan sebelum data asli: pisahkan demo dan lingkungan privat, rotasi password fixture/rahasia yang pernah dibagikan, batasi akses HR, dan cabut sesi lama sesuai prosedur. Catatan deployment menyebut token Vercel pernah dibagikan; **status rotasinya belum diverifikasi**. Tidak ada kredensial yang diubah otomatis.

## 3. Temuan P2 — kelengkapan dan konsistensi

| ID    | Temuan dan bukti                                                                                                                                                                                                                                                                                           | Arah perbaikan                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-01 | Administrasi akun di situs live masih memakai `people`, `accountRoles`, `accountStatus` simulasi. Nadia/Dimas tampil sebagai Karyawan; 10 karyawan ditampilkan seolah 10 akun, padahal ada 7 akun Auth/profil. Helper invite/update ada tetapi belum dipakai UI.                                           | Render Account DTO, pisahkan employee tanpa akun, sambungkan action sebenarnya dengan konfirmasi dan error handling                                                          |
| P2-02 | Helper admin untuk `operation_requests` juga menuju public dan gagal PGRST205. Tabel hanya ada di private. Jalur invite tidak dapat menjalankan bookkeeping dengan query sekarang. Tidak ada email/akun baru dibuat untuk membuktikannya.                                                                  | RPC/server provisioning private yang aman; tangani error setiap query, rekonsiliasi partial failure/idempotency                                                              |
| P2-03 | `/auth/recovery` merespons **404**, sementara endpoint reset password mengarah ke path itu. Config Auth deployed masih `site_url=http://localhost:3000`, redirect allowlist kosong, signup publik belum disabled. Callback belum mengaktifkan profil INVITED; handling code/token flow perlu diverifikasi. | Selesaikan UI recovery/invite + redirect produksi/preview allowlist, aktivasi trusted, dan kebijakan signup                                                                  |
| P2-04 | POST login dengan JSON `null`, UUID filter invalid, dan tanggal kalender `2026-02-30` mengembalikan **500**, bukan 400/422.                                                                                                                                                                                | Schema request object/strict fields, UUID dan tanggal kalender, mapping error DB yang benar                                                                                  |
| P2-05 | Ekspor karyawan `q=Rizky` dan tanpa filter sama-sama berisi **11 baris CSV** (header + 10 karyawan). UI juga tidak mengirim filter.                                                                                                                                                                        | Terapkan filter di query export dan UI; validasi batas row, jangan silent truncation                                                                                         |
| P2-06 | `expectedVersion=null` pada RPC kontak langsung diterima. Perbandingan `version <> NULL` tidak menolak mutation; pattern yang sama ada pada RPC lain.                                                                                                                                                      | Validasi integer positif/non-null di database sendiri dan tes direct RPC                                                                                                     |
| P2-07 | Dalam rollback, gaji diubah setelah draft dibuat; publish tetap memakai nominal snapshot draft lama, bukan gaji terkini saat publish seperti kontrak.                                                                                                                                                      | Tegaskan kebijakan snapshot draft vs publish. Jika mengikuti kontrak, ambil ulang kompensasi/nama secara atomik dan validasi ulang potongan                                  |
| P2-08 | Manager dapat menilai employee inactive pada timnya lewat RPC. Upsert review membaca version tanpa `FOR UPDATE`/predicate version pada UPDATE. Edit payroll mengambil lock item lalu parent, publish mengambil parent lalu item.                                                                           | Tolak target nonaktif; atomic optimistic lock; urutan lock konsisten. Race review dan deadlock payroll baru temuan kode, belum direproduksi                                  |
| P2-09 | Logout dengan cookie + Origin asing diterima 200; tidak ditemukan validasi Origin/CSRF token. Cookie sesi produksi tidak memiliki Secure/HttpOnly, SameSite=lax. Password endpoint juga membutuhkan review proteksi mutation.                                                                              | Proteksi CSRF/Origin, Secure untuk HTTPS; sesuaikan HttpOnly dengan pilihan SSR/browser SDK. Tes HTTP ini tidak membuktikan browser cross-site dapat membawa cookie SameSite |
| P2-10 | Callback `nextRaw.startsWith('/')` juga menerima `//host-lain`; bila code exchange valid, redirect tidak terbatas pada origin.                                                                                                                                                                             | Normalisasi URL dan pastikan origin/path allowlisted; jangan mengikuti redirect eksternal dari query                                                                         |
| P2-11 | Frontend membuang metadata pagination; direktori/cuti/master mengambil halaman pertama maksimum 100, absensi maksimum default 20. Master card/form diambil dari `people` bukan daftar master, sehingga master tanpa anggota tidak akan muncul.                                                             | Pagination/filter server nyata, gunakan Master DTO langsung, tangani data besar                                                                                              |
| P2-12 | Periode hard-coded Agustus–Oktober 2026. September tanpa review memakai fallback skor/catatan contoh bahkan pada live; dashboard tidak memanggil dashboard API dan review baru dimuat di halaman kinerja. State demo dipakai saat inisialisasi live dan sebagian error 401/403 diabaikan.                  | Periode dinamis, hilangkan fallback demo live, gunakan data ringkasan server, loading/empty/error per modul dan refresh session terpusat                                     |
| P2-13 | Label "Demo frontend/data contoh selama sesi" tetap muncul ketika data sebenarnya persisten. Modul akun/PRD/audit lama masih menyebut backend/deploy belum tersedia; deployment guide masih menyebut belum ada migration.                                                                                  | Selaraskan label status dan dokumen; jangan mengklaim semua modul selesai hanya karena helper API tersedia                                                                   |
| P2-14 | CI belum menjalankan RLS/HTTP/backend/concurrency dan lint backend. Tidak ada `supabase/config.toml`, suite `supabase/tests`, atau ledger `supabase_migrations.schema_migrations` pada DB. `db-apply` menjalankan ulang file tanpa ledger dan tetap lanjut setelah satu file gagal.                        | Supabase migration workflow standar/ledger, berhenti pada failure, database uji terisolasi dan quality gate backend sebelum deployment                                       |
| P2-15 | HSTS tersedia, CSP/X-Content-Type-Options/X-Frame-Options belum terlihat pada homepage. Storage mempunyai **0 bucket**.                                                                                                                                                                                    | Hardening header sesuai kebutuhan, putuskan apakah foto/dokumen PRD masuk MVP; jika iya, implementasikan private bucket/policy dan validasi upload                           |

Tidak semua konfigurasi yang kurang merupakan exploit yang sudah terbukti. Cookie HttpOnly perlu mengikuti arsitektur klien, dan grant TRUNCATE tidak diuji secara destruktif. Temuan kode yang belum direproduksi dipisahkan dari hasil tes live.

## 4. Perlindungan data selama pengujian

Tes tulis database menggunakan blok SQL yang **wajib berakhir dengan exception penanda**, sehingga seluruh perubahan pada employee, kontak, gaji, cuti, penilaian, payroll dan audit dibatalkan. Error tersebut adalah mekanisme rollback tes, bukan error aplikasi yang dianggap lulus.

Baseline dan sesudah probe utama tetap sama:

| Data           | Sebelum | Sesudah |
| -------------- | ------- | ------- |
| Employees      | 10      | 10      |
| Leave requests | 4       | 4       |
| Payroll runs   | 2       | 2       |
| Payroll items  | 14      | 14      |
| Attendances    | 2       | 2       |
| Audit events   | 18      | 18      |

Probe concurrency juga memastikan jumlah leave request tetap 4 setelah kedua transaksi selesai. Pemeriksaan integritas data yang tersedia menemukan 0 nominal payroll tidak konsisten, 0 checkout sebelum check-in, dan 0 metadata keputusan yang tidak konsisten. Ini tidak menggantikan constraint untuk data baru.

Login/logout hanya memakai akun fixture akademik. Browser pengujian sudah logout dan viewport dikembalikan. Tidak ada email reset/undangan dikirim, akun dibuat, data dihapus, Supabase di-reset, atau production dideploy ulang.

Script diagnostik berada di folder lokal **ignored** `work/audit-2026-10-07.mjs`. Tidak berisi nilai secret; membaca environment lokal yang tidak di-commit. Script ini bukan pengganti suite regresi permanen: khususnya tes HTTP cross-Origin sengaja menguji penolakan logout, sehingga logout saat ini memang menutup sesi fixture. Jalankan hanya pada lingkungan/akun uji yang disepakati.

## 5. Urutan tindak lanjut

1. **Amankan jalur akses:** samakan RLS/RPC/API, larang nonaktif/INVITED pada semua operasi, persempit grants, lindungi self/last HR dan pisahkan demo publik dari sistem privat.
2. **Lindungi integritas:** locking pengajuan cuti, null/stale version, snapshot payroll, urutan lock dan target penilaian.
3. **Selesaikan UI/API:** pembacaan gaji/kontak dan form edit, administrasi akun, undangan/recovery, master, pagination dan ekspor sesuai filter.
4. **Perkuat rilis:** migration ledger, suite backend/RLS/concurrency di database uji, gate CI, backup/recovery dan monitoring.
5. **Samakan laporan akademik:** PRD, UML dan status implementasi sesuai hasil uji terbaru.

## 6. Belum diuji atau belum dapat dinyatakan selesai

- Pengiriman email undangan/reset, penerimaan email, aktivasi pengguna baru dan ganti password: tidak dijalankan agar tidak mengirim email/mengubah kredensial tanpa kebutuhan.
- Race dua approval/publish, race review dan deadlock publish vs edit payroll: hanya sebagian ditinjau statis; wajib tes regresi di database disposable.
- Backup/restore, retensi, SMTP deliverability, rotasi token Vercel, branch protection dan approval deployment: belum diverifikasi end-to-end.
- Beban tinggi, WCAG menyeluruh, browser selain Chromium, cetak/PDF lintas browser, keamanan upload/Storage: belum lulus audit khusus.
- Kebijakan libur nasional, shift, pro-rata/carry-over, koreksi absensi dan hubungan supervisor: perlu keputusan tim, bukan otomatis bug scope MVP.

Audit ini tidak menyatakan aplikasi bebas seluruh kerentanan atau "semuanya sudah aman". Hasil memberi bukti yang dapat ditindaklanjuti tanpa mengubah runtime aplikasi.

## Referensi mekanisme

- [Supabase RLS dan grants](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase SSR Auth](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
