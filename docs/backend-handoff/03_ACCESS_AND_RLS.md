# 03 — Matriks akses dan rancangan RLS

Status: **spesifikasi allow/deny; belum ada policy SQL yang diterapkan atau dinyatakan lulus**. RLS backend bukan pengganti validasi API, dan validasi API bukan pengganti RLS/grants. Baca [database](02_DATABASE_DESIGN.md) untuk pemisahan field/tabel.

## 1. Identitas dan predikat akses

Semua operasi data membutuhkan JWT terverifikasi, `user_profiles.account_status=ACTIVE` dan karyawan terhubung berstatus ACTIVE. INVITED/DISABLED/inactive employee ditolak. Auth callback aktivasi undangan adalah flow terpisah yang dibatasi, bukan jalan pintas read/write data HR.

Usulan helper internal: current_employee_id, current_business_role, is_active_actor, current_department_id. Helper mengambil hanya identitas `auth.uid()` saat ini dan hasil lookup terproteksi; jangan menerima arbitrary userId dari client. Role tidak diambil dari body, UI atau user_metadata.

Manager scope menggunakan departemen saat operasi, termasuk ketika master di-rename. Pemindahan karyawan/Manager ke departemen lain mengubah scope untuk operasi berikutnya; histori approval tetap mencatat actor lama. Supervisor lintas departemen belum ada pada v1.

## 2. Matriks baca

`own` = karyawan yang terhubung ke akun sendiri. `team` = departemen Manager saat ini. Selalu terapkan predikat akun aktif.

| Data                                  | ADMIN_HR                                    | MANAGER              | EMPLOYEE                         | Tanpa login/nonaktif |
| ------------------------------------- | ------------------------------------------- | -------------------- | -------------------------------- | -------------------- |
| Direktori employees tanpa gaji/kontak | Semua                                       | Team termasuk own    | Own                              | Deny                 |
| employee_contacts                     | Semua                                       | Own saja             | Own saja                         | Deny                 |
| employee_compensation                 | Operasi/proyeksi HR aman                    | Deny                 | Deny                             | Deny                 |
| user_profiles / accounts              | Semua untuk administrasi                    | Own role/status saja | Own role/status saja             | Deny                 |
| departments / positions aktif         | Read                                        | Read                 | Read                             | Deny                 |
| attendances                           | Semua                                       | Team                 | Own                              | Deny                 |
| leave_requests                        | Semua                                       | Team                 | Own                              | Deny                 |
| leave balance                         | Own; operasi admin terpisah bila diperlukan | Own                  | Own                              | Deny                 |
| payroll_runs/items                    | Semua termasuk draft                        | Deny                 | Own item + parent PUBLISHED saja | Deny                 |
| performance_reviews                   | Semua                                       | Team                 | Own                              | Deny                 |
| hr_policy nonsensitif                 | Read                                        | Read                 | Read                             | Deny                 |
| audit_events                          | Proyeksi administratif yang dibatasi        | Deny                 | Deny                             | Deny                 |

RLS baris employees tidak boleh menjadi alasan menaruh gaji di tabel tersebut. Kontak tim Manager yang saat ini tampak pada demo harus dihilangkan saat integrasi. Nama master organisasi boleh terbaca akun aktif, tetapi jumlah anggota/agregasi tidak boleh membocorkan anggota di luar scope.

## 3. Matriks tulis

| Operasi                                   | Pemohon           | Kontrol wajib                                                                |
| ----------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| Tambah/edit/nonaktifkan karyawan          | HR                | Field allowlist, expectedVersion, FK valid, identitas HR tetap aktif         |
| Edit contact sendiri                      | Semua role aktif  | Hanya phone/address, own employee_id, version contact                        |
| Tambah/rename master                      | HR                | Nama trim unik case-insensitive, FK tidak berubah                            |
| Check-in/out                              | Semua role aktif  | Own + waktu/tanggal server, UNIQUE employee/date, urutan sekali masuk/keluar |
| Ajukan cuti                               | EMPLOYEE          | Own, PENDING default, kuota/bentrok atomik; bukan role/pemilik dari client   |
| Putuskan cuti                             | MANAGER           | Team, bukan own, hanya PENDING, version, alasan REJECTED wajib               |
| Draft/edit/publish payroll                | HR                | DRAFT saja untuk edit, seluruh snapshot satu transaksi; published immutable  |
| Buat/revisi penilaian                     | MANAGER           | Target team aktif bukan own, score 0–100, periode/version + audit            |
| Invite/update akun                        | HR                | Current DB role, last-HR/self protection, server admin client terisolasi     |
| Update role/status sendiri melalui profil | Tidak ada         | Selalu deny; edit kontak tidak boleh menyelundupkan role/status              |
| Hard delete data/histori/audit            | Tidak ada pada v1 | Deny; pengarsipan/revisi merupakan perubahan kontrak berikutnya              |

Role HR tidak otomatis boleh mengambil alih persetujuan Manager atau mengubah skor. Manager tidak otomatis mendapat payroll hanya karena tabel employee own tersedia. Jika kebijakan ini ingin diubah, ubah PRD, matriks, kontrak dan tes bersama.

## 4. Strategi grants/RLS/RPC

1. Schema private tidak masuk exposed schemas. Cabut akses anon/public yang tidak diperlukan, terapkan grants minimum secara eksplisit.
2. Pada tabel public aktifkan RLS sebelum memberi akses. Tidak membuat policy `USING (true)` untuk data HR umum.
3. `authenticated` mendapat SELECT yang benar-benar diperlukan dengan RLS di atas. Public masters juga membutuhkan actor aktif; anon tidak memperoleh data aplikasi.
4. Untuk v1, tabel bisnis dan user_profiles **tidak mempunyai direct INSERT/UPDATE/DELETE dari client**. Mutation melalui RPC/operasi server yang terotorisasi. Ini berlaku sekalipun client mencoba REST Supabase langsung dengan publishable key.
5. Fungsi yang dapat menggunakan SECURITY INVOKER diprioritaskan. RPC lintas private schema atau mutation tanpa grants direct mungkin membutuhkan SECURITY DEFINER: owner tepercaya/hak minimum, search_path aman, semua object schema-qualified, parameter allowlist, cek auth.uid/role/status/scope dalam fungsi itu sendiri.
6. Cabut EXECUTE bawaan dari PUBLIC/anon. Grant EXECUTE hanya ke role yang memerlukan; fungsi tetap memeriksa role bisnis. Fungsi internal role helper tidak boleh menjadi endpoint role-management atau oracle data pengguna lain.
7. Lookup role/helper jangan membuat recursion policy user_profiles → employees → user_profiles. Review definisi helper, owner dan RLS bypass dengan tes sebelum dipakai.
8. Pisahkan Supabase client user dan admin. Query rutin memakai user JWT agar RLS tetap berlaku; jangan menjalankan semua endpoint memakai secret/service-role lalu berharap RLS mengamankannya.
9. Views/proyeksi/RPC agregasi harus mempertahankan scope dan tidak membocorkan kolom. Review apakah view menggunakan mode security yang benar atau fungsi melakukan otorisasi ulang; jangan menganggap view otomatis menerapkan seluruh RLS tabel.
10. Audit write terjadi dalam operasi tepercaya, tidak dari event frontend yang bisa dipalsukan. Cek file CSV, detail slip, dashboard dan filter secara khusus; tidak cukup hanya list table.

RLS membaca data caller, bukan menjalankan seluruh aturan bisnis concurrency. Kuota, publish payroll, uniqueness dan locking tetap membutuhkan transaksi/constraint. Policy SELECT yang benar tidak membuat fungsi elevated otomatis aman.

Bookkeeping `private.operation_requests` tidak dapat dibaca atau ditulis pengguna aplikasi, termasuk lewat REST/RPC generik. Akses server provisioning dibatasi ke operasi undangan HR yang sudah diotorisasi. Pembuatan fungsi elevated dan pencabutan EXECUTE default dilakukan dalam satu migration/transaksi terkontrol; `search_path` tidak memuat schema yang dapat ditulisi pemohon, dan object sensitif selalu schema-qualified. Rujukan: [PostgreSQL CREATE FUNCTION — keamanan SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html).

## 5. Kehidupan session dan privilege

- Session cookie/JWT diverifikasi di server, kemudian status/role dari DB ditinjau pada setiap operasi sensitif. JWT lama tidak boleh mempertahankan akses setelah role/status DB berubah.
- Pengguna tidak boleh memilih role pada login nyata. UI membaca role dari `/me`, tetapi backend tetap menolak aksi yang dimanipulasi.
- HR tidak boleh menurunkan role/menonaktifkan dirinya melalui UI admin v1 atau menghilangkan HR aktif terakhir. Edit employment_status pada employee juga harus menghormati invariant HR aktif terakhir, bukan hanya endpoint accounts.
- Untuk undangan, disable signup publik bebas dan gunakan provisioning server. Aktivasi INVITED hanya setelah flow Auth valid, tidak cukup `accountStatus: ACTIVE` dari browser.
- Reset password menggunakan flow Supabase dan redirect allowlist; jangan mengirim password baru ke admin lain atau menyimpan password di tabel aplikasi.
- Kredensial elevated hanya server secret store; tidak memakai prefix NEXT_PUBLIC, tidak masuk repo/log/chat. Publishable key bukan pengganti identitas user.
- Penonaktifan akun harus menguji akses dengan JWT/session yang sebelumnya masih valid. Logout/revoke session dapat ditambahkan, tetapi perubahan DB status wajib cukup untuk menghentikan akses aplikasi berikutnya.

## 6. Uji akses yang wajib menyertai migration

Untuk setiap tabel: uji SELECT/INSERT/UPDATE/DELETE sebagai anon, HR, Manager team, employee own, employee luar scope, INVITED, DISABLED dan employee inactive. Untuk RPC elevated, ulangi seluruh role dan input tampering; jangan hanya mengetes handler Next.js.

Uji field privat, dashboard count, query filter, parent-child payroll, exported CSV, ID guessing, role self-update dan API Supabase langsung. Referensi daftar lengkap: [tes penyerahan](05_TEST_AND_DELIVERY.md). Hasil policy belum lulus sampai suite dijalankan di lingkungan uji.

## Referensi resmi

Matriks ini keputusan proyek; dasar mekanisme: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Panduan tersebut menekankan grants, policy dan tes allow/deny, serta risiko views. [API keys](https://supabase.com/docs/guides/getting-started/api-keys) menjelaskan bahwa secret/service-role bypass RLS. [SSR Auth](https://supabase.com/docs/guides/auth/server-side/nextjs) menjadi acuan verifikasi session server.
