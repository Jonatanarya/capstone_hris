# 02 — Rancangan PostgreSQL/Supabase

Status: **rancangan, bukan migration SQL yang sudah dijalankan**. Referensi payload: [kontrak API](01_API_CONTRACT.md). Seluruh constraint, grants/RLS dan RPC harus dibuat dan diuji PIC backend. Lingkup satu organisasi; jangan menambahkan tenant ID setengah jadi tanpa revisi desain.

## 1. Konvensi dan hubungan

ID aplikasi UUID server-generated. `employee_no` unik adalah nomor induk, bukan PK. `auth.users` dikelola Supabase Auth; jangan membuat tabel password sendiri atau memodifikasi sistem Auth melalui seed SQL manual.

Relasi inti:

| Dari                                                           | Ke              | Kardinalitas/keterangan                                                  |
| -------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| employees.department_id                                        | departments.id  | Banyak karyawan dalam satu departemen                                    |
| employees.position_id                                          | positions.id    | Banyak karyawan dalam satu jabatan                                       |
| user_profiles.user_id                                          | auth.users.id   | PK/FK, satu profil per identitas Auth                                    |
| user_profiles.employee_id                                      | employees.id    | UNIQUE, maksimum satu akun per karyawan; karyawan boleh belum punya akun |
| employee_contacts.employee_id                                  | employees.id    | PK/FK, satu kontak privat per karyawan                                   |
| employee_compensation.employee_id                              | employees.id    | PK/FK, satu gaji pokok terkini per karyawan                              |
| attendances / leave_requests / performance_reviews.employee_id | employees.id    | Histori per karyawan                                                     |
| payroll_items.payroll_run_id                                   | payroll_runs.id | Banyak item dalam satu periode                                           |
| payroll_items.employee_id                                      | employees.id    | Satu item per karyawan/periode                                           |
| annual_leave_entitlements.employee_id                          | employees.id    | Satu baris per karyawan/tahun                                            |

Tidak menyimpan departemen/jabatan sebagai teks pada karyawan. Rename master tidak mengubah FK. Snapshot teks hanya digunakan pada payroll published untuk menjaga dokumen historis.

## 2. Kamus tabel

Semua tabel mutable di bawah mempunyai `created_at`, `updated_at` berupa `timestamptz` yang dicatat server dan `version integer NOT NULL DEFAULT 1`. Setiap mutation yang relevan menaikkan version; audit event append-only tidak mempunyai version/update. Waktu UTC, tanggal kerja dikonversi Asia/Jakarta.

### 2.1 `public.departments` dan `public.positions`

| Kolom  | Tipe/constraint                                               |
| ------ | ------------------------------------------------------------- |
| id     | uuid PK                                                       |
| name   | text, trim bukan kosong, panjang 1–150, unik case-insensitive |
| status | ACTIVE / INACTIVE, default ACTIVE                             |

V1 API hanya tambah/rename. Status disediakan untuk pengarsipan berikutnya, bukan hard delete. Assignment baru hanya ke master aktif. FK memakai RESTRICT untuk mencegah referensi histori terhapus. Jabatan tidak terikat departemen pada v1; jika perlu, sepakati tabel pemetaan terpisah.

### 2.2 `public.employees` — direktori tanpa gaji/alamat

| Kolom             | Tipe/constraint                                    |
| ----------------- | -------------------------------------------------- |
| id                | uuid PK                                            |
| employee_no       | text, uppercase, unik, panjang 1–30                |
| full_name         | text, trim bukan kosong, maksimum 150              |
| work_email        | text, normalisasi lowercase, unik case-insensitive |
| department_id     | uuid FK departments NOT NULL                       |
| position_id       | uuid FK positions NOT NULL                         |
| employment_status | ACTIVE / INACTIVE NOT NULL                         |
| joined_on         | date NOT NULL                                      |

Tidak menaruh `salary`, `score`, `phone` atau `address` di sini. Pemisahan ini penting karena RLS membatasi baris, bukan otomatis menyembunyikan kolom gaji pada baris yang boleh dibaca Manager.

### 2.3 `public.user_profiles` — role/status akun terproteksi

| Kolom          | Tipe/constraint                        |
| -------------- | -------------------------------------- |
| user_id        | uuid PK/FK auth.users.id               |
| employee_id    | uuid UNIQUE FK employees.id NOT NULL   |
| role           | ADMIN_HR / MANAGER / EMPLOYEE NOT NULL |
| account_status | INVITED / ACTIVE / DISABLED NOT NULL   |

Role berasal dari tabel ini, bukan request, dropdown demo atau user_metadata yang bisa diedit pengguna. Pemohon biasa tidak boleh insert/update/delete profil. Self-read dan HR-read dengan kebijakan aman; perubahan hanya operasi administratif terotorisasi. Role bisnis tidak sama dengan role PostgreSQL.

Menghapus Auth user berpotensi merusak histori approver/assessor: jangan hard delete akun pada v1. Pertahankan identitas audit dan gunakan DISABLED. Jika kelak ada kewajiban penghapusan, rancang anonymization dan FK historis dahulu.

### 2.4 `public.employee_contacts` — data privat HR/pemilik

| Kolom       | Tipe/constraint                                            |
| ----------- | ---------------------------------------------------------- |
| employee_id | uuid PK/FK employees.id                                    |
| phone       | text, 8–20 karakter, validasi pola telepon yang disepakati |
| address     | text, trim bukan kosong, panjang 1–2.000                   |

Manager hanya boleh membaca kontak sendiri, bukan seluruh kontak tim. Update own contact menerima dua field tersebut, tidak dapat mengganti employee_id. Mutation contact juga menaikkan version aggregate employees agar edit HR dari snapshot lama tidak menimpa edit kontak pengguna tanpa konflik.

### 2.5 `private.employee_compensation` — gaji pokok terkini

| Kolom           | Tipe/constraint             |
| --------------- | --------------------------- |
| employee_id     | uuid PK/FK employees.id     |
| base_salary_idr | bigint, 0–1.000.000.000.000 |

Schema `private` tidak diekspos sebagai Data API. Read/write hanya melalui operasi HR yang memverifikasi pemohon. Karyawan mengetahui gaji dari payroll miliknya yang sudah terbit, bukan akses tabel kompensasi. Perubahan kompensasi menaikkan version aggregate employee dan compensation.

### 2.6 `public.attendances`

| Kolom        | Tipe/constraint                                 |
| ------------ | ----------------------------------------------- |
| id           | uuid PK                                         |
| employee_id  | uuid FK employees NOT NULL                      |
| work_date    | date Jakarta server, NOT NULL                   |
| check_in_at  | timestamptz NOT NULL dari server                |
| check_out_at | timestamptz nullable, tidak sebelum check_in_at |
| status       | PRESENT / LATE, dihitung server saat masuk      |

UNIQUE(employee_id, work_date). Tidak membuat record kosong untuk setiap karyawan yang belum absen; absence dihitung dari directory scoped LEFT JOIN record. Update langsung waktu/status/pemilik dilarang. V1 check-out untuk tanggal kerja hari ini saja; shift lintas tengah malam/koreksi histori belum didukung.

### 2.7 `private.annual_leave_entitlements`

| Kolom            | Tipe/constraint                       |
| ---------------- | ------------------------------------- |
| employee_id      | uuid FK employees                     |
| year             | integer, tahun kebijakan              |
| entitlement_days | integer nonnegatif, default usulan 12 |

PK(employee_id, year). Baris ini juga menjadi titik lock transaksi permohonan. Tahun baru tidak otomatis membaca kuota tahun sebelumnya. Buat entitlement sebelum pengajuan; jika belum tersedia, tolak dengan error kebijakan/validasi yang jelas, bukan diam-diam memberikan kuota tak terbatas.

`usedDays` berasal dari ANNUAL APPROVED; `reservedDays` dari ANNUAL PENDING; `availableDays = entitlementDays - usedDays - reservedDays`. Ditolak tidak dihitung. Jangan menyimpan tiga counter duplikat tanpa mekanisme rekonsiliasi. Kuota tetap tidak boleh negatif; backend mengunci entitlement yang sama sebelum menghitung/membuat request.

### 2.8 `public.leave_requests`

| Kolom                 | Tipe/constraint                                    |
| --------------------- | -------------------------------------------------- |
| id                    | uuid PK                                            |
| employee_id           | uuid FK employees NOT NULL                         |
| type                  | ANNUAL / PERMISSION / SICK                         |
| start_date / end_date | date NOT NULL; end >= start, tahun sama            |
| working_days          | integer > 0, dihitung server berdasarkan kebijakan |
| reason                | text trim 1–2.000                                  |
| status                | PENDING / APPROVED / REJECTED, default PENDING     |
| submitted_at          | timestamptz server NOT NULL                        |
| decided_by            | uuid FK user_profiles.user_id nullable             |
| decided_at            | timestamptz nullable                               |
| rejection_reason      | text nullable; wajib trim 1–2.000 bila REJECTED    |

PENDING harus memiliki metadata keputusan NULL. APPROVED/REJECTED harus mempunyai decided_by/at; APPROVED tidak mempunyai rejection_reason. Working days tidak boleh berasal dari body frontend. Cegah overlap tanggal antarrequest PENDING/APPROVED pada karyawan sama, termasuk jenis berbeda. Dapat memakai exclusion constraint rentang tanggal (termasuk kedua ujung) dan/atau locking employee/entitlement yang konsisten; beri tes concurrency.

### 2.9 `public.payroll_runs`

| Kolom                       | Tipe/constraint                                                       |
| --------------------------- | --------------------------------------------------------------------- |
| id                          | uuid PK                                                               |
| period_start                | date hari pertama bulan, UNIQUE                                       |
| status                      | DRAFT / PUBLISHED, default DRAFT                                      |
| published_at / published_by | timestamptz / FK user_profiles, nullable untuk DRAFT, wajib PUBLISHED |

API mengubah period_start menjadi `YYYY-MM`. Status dan metadata tidak boleh ditulis langsung oleh client/HR table editor aplikasi; hanya fungsi publish. V1 tidak ada reopen/cancel.

### 2.10 `public.payroll_items`

| Kolom                                             | Tipe/constraint                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| id                                                | uuid PK                                                                    |
| payroll_run_id / employee_id                      | uuid FK, UNIQUE pasangan                                                   |
| allowance_idr / bonus_idr / deduction_idr         | bigint 0–1.000.000.000.000; default 0                                      |
| base_salary_snapshot_idr                          | bigint nullable DRAFT, wajib PUBLISHED                                     |
| employee_no_snapshot / full_name_snapshot         | text nullable DRAFT, wajib PUBLISHED                                       |
| department_name_snapshot / position_name_snapshot | text nullable DRAFT, wajib PUBLISHED                                       |
| net_salary_snapshot_idr                           | bigint/generated atau dihitung transaksi, wajib nonnegatif setelah publish |

Draft membaca gaji/nama terkini melalui proyeksi HR aman. Publish mengambil ulang gaji/nama/master saat transaksi dan menyimpan snapshot seluruh item, mengecek ulang potongan, lalu mengunci run/items. Nominal allowance 500.000 dan bonus 250.000 pada demo **bukan default hak karyawan**; dipakai hanya fixture contoh. Published tidak ikut berubah ketika profil/gaji/master berubah.

Parent-child status bukan CHECK lintas tabel biasa: enforce melalui RPC/trigger dan pembatasan hak update. Karyawan tidak dapat membaca draft item, sekalipun employee_id miliknya. Histori karyawan nonaktif tetap dapat dibaca HR.

### 2.11 `public.performance_reviews`

| Kolom        | Tipe/constraint                        |
| ------------ | -------------------------------------- |
| id           | uuid PK                                |
| employee_id  | uuid FK employees NOT NULL             |
| period_start | date hari pertama bulan                |
| score        | integer 0–100                          |
| notes        | text trim 1–2.000                      |
| assessed_by  | uuid FK user_profiles.user_id NOT NULL |
| assessed_at  | timestamptz server NOT NULL            |

UNIQUE(employee_id, period_start). Hanya Manager departemen target aktif, bukan dirinya. Revisi periode oleh manager yang berwenang mencatat assessor baru dan audit before/after; jangan menghilangkan jejak penilaian lama. HR/Karyawan tidak menulis nilai langsung.

### 2.12 `private.audit_events`

id uuid, actor_user_id, action, resource_type, resource_id, occurred_at timestamptz, request_id, perubahan field yang diizinkan. Append-only melalui operasi server/database; client tidak dapat insert/update/delete. Jangan menyimpan password, token, cookie, secret atau payload alamat/gaji lengkap secara sembarangan. Tentukan redaksi, retensi, dan akses HR terbatas sebelum log ditampilkan.

### 2.13 `public.hr_policy`

Satu konfigurasi organisasi dengan timezone Asia/Jakarta, jam masuk 08:00, jam keluar 17:00, daftar hari kerja ISO 1–5, default entitlement 12 dan policy_version. Read semua akun aktif, write HR melalui operasi administratif yang diuji (belum endpoint v1). Jangan masukkan rahasia ke tabel ini. Perubahan kebijakan tidak mengubah working_days/status presensi historis secara diam-diam. Attendances dan leave_requests juga menyimpan `policy_version integer` serta `policy_snapshot jsonb` berisi hanya aturan relevan yang dipakai saat pencatatan; keduanya ditentukan server, bukan request. Snapshot diperlukan karena nomor versi saja tidak menyimpan isi kebijakan lama.

### 2.14 `private.operation_requests` — bookkeeping undangan

| Kolom                               | Tipe/constraint                                                  |
| ----------------------------------- | ---------------------------------------------------------------- |
| id                                  | uuid PK                                                          |
| actor_user_id                       | uuid FK user_profiles.user_id                                    |
| operation / idempotency_key         | text / uuid; UNIQUE(actor_user_id, operation, idempotency_key)   |
| payload_hash                        | hash payload kanonis yang telah divalidasi; bukan password/token |
| employee_id / external_auth_user_id | uuid target / uuid nullable hasil provisioning Auth              |
| state                               | PROCESSING / SUCCEEDED / FAILED                                  |
| result_account                      | jsonb nullable, proyeksi Account aman untuk replay               |
| failure_code / expires_at           | kode aman nullable / timestamptz untuk kebijakan retensi         |

Tidak diekspos melalui Data API atau daftar akun. Hanya server provisioning terotorisasi yang membaca/menulisnya. Klaim key harus atomik; key sama dengan payload berbeda ditolak. PROCESSING mengembalikan konflik sementara, bukan membuat undangan kedua. FAILED membutuhkan rekonsiliasi status Auth/profile sebelum retry; jangan menghapus record yang masih membutuhkan cleanup. SUCCEEDED dapat replay respons tanpa password/token setelah otorisasi HR terkini diperiksa ulang. Tentukan masa retensi, recovery job dan batas retry bersama backend; ini bukan jaminan transaksi lintas layanan.

## 3. Transaksi/RPC yang dibutuhkan

Nama di bawah adalah usulan RPC, bukan fungsi yang sudah tersedia. Parameter aktor/pemilik/waktu tidak boleh dikirim client; gunakan identitas JWT yang terverifikasi dan waktu server. Detail keamanan fungsi ada di [RLS](03_ACCESS_AND_RLS.md).

| Operasi             | RPC usulan                        | Tanggung jawab transaksi                                                                           |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Buat/edit karyawan  | create_employee / update_employee | HR; employees + contacts + compensation + version + audit atomik                                   |
| Ubah kontak sendiri | update_my_contact                 | Own; allowlist contact, cek contact.version, bump aggregate employee.version                       |
| Presensi            | check_in / check_out              | Own active; UNIQUE dan status order atomik                                                         |
| Pengajuan cuti      | submit_leave_request              | Own EMPLOYEE; lock entitlement/employee, hitung ulang kuota/overlap/hari, insert + audit           |
| Keputusan cuti      | decide_leave_request              | Manager scope; lock request dan entitlement dalam urutan konsisten, hanya PENDING, version + audit |
| Draft payroll       | create_payroll_run                | HR; periode unik dan items active employee dalam transaksi                                         |
| Edit item           | update_payroll_item               | HR; lock parent run, DRAFT + item version + nilai valid                                            |
| Terbit payroll      | publish_payroll_run               | HR; lock run/items dan kompensasi, semua snapshot + status + audit atomik                          |
| Penilaian           | upsert_performance_review         | Manager scope, UNIQUE employee/period + version + audit                                            |
| Role/status akun    | update_account                    | HR; current role/status, larangan self/last-admin, version + audit                                 |

Tentukan urutan lock global agar approval, pengajuan, payroll dan edit profil tidak deadlock. Gunakan constraint sebagai pertahanan tambahan, bukan hanya validasi UI. Rollback harus memastikan tidak ada kuota terpesan dua kali, item setengah terbit atau catatan audit sukses untuk transaksi gagal.

## 4. Auth dan undangan bukan transaksi DB biasa

Pembuatan akun Supabase Auth dan insert user_profiles melibatkan layanan berbeda. Jangan mengklaim satu transaksi SQL menjamin keduanya. Operasi invite membutuhkan idempotency, state provisioning, kompensasi/retry dan audit yang jelas.

1. HR tervalidasi memilih employee aktif yang belum terhubung ke akun.
2. Server admin membuat undangan melalui Supabase Auth, bukan INSERT manual auth.users.
3. Hubungkan profile employee + role INVITED; jika langkah DB gagal, catat kegagalan provisioning dan lakukan cleanup/retry yang terkontrol. Jangan meninggalkan akun berhak akses tanpa profile.
4. Callback invite memverifikasi flow Auth/konfirmasi user melalui server, lalu mengaktifkan akun tersebut. INVITED tidak memperoleh akses data HR sebelum aktivasi selesai.
5. Penonaktifan memblokir setiap operasi melalui account_status + employment_status terkini. Penghapusan cookie/revoke session tambahan tidak menggantikan pemeriksaan ini.

Untuk M1, akun uji dapat diprovisioning oleh PIC backend secara privat sebelum UI undangan selesai. Bootstrap HR pertama melalui proses tepercaya; jangan memberi role HR berdasarkan email/domain atau signup metadata.

## 5. Migration dan index

Urutan: schema/enum → master → employees → contacts/compensation → user_profiles → policy/entitlements → attendance/leave → payroll/reviews → helper/RPC → grants/RLS/trigger → fixture dan tes. Pengaktifan grants/RLS harus satu perubahan terkontrol sebelum API terpapar.

Index minimum: employees.department_id, normalized employee_no/email/name; attendances(employee_id, work_date), leave_requests(employee_id, status, start_date, end_date), payroll_items(employee_id, payroll_run_id), performance_reviews(employee_id, period_start), audit resource/time. Uniqueness PK/FK yang disebut tetap wajib; index kueri disesuaikan hasil EXPLAIN setelah data uji.

File migration tinggal di `supabase/migrations/` setelah backend mengimplementasikan. Folder tersebut belum dibuat oleh handoff ini. Lacak perubahan di Git, jangan menjadikan klik SQL Editor sebagai satu-satunya sumber schema. Fixture Auth dibuat melalui sarana Auth yang tepat; contoh UUID di kontrak adalah ilustrasi, bukan user Auth nyata.

Reset/rebuild hanya untuk database lokal disposable berisi data uji. Jangan menjalankan reset pada project remote atau database dengan data penting. [Panduan migration Supabase](https://supabase.com/docs/guides/local-development/database-migrations).
