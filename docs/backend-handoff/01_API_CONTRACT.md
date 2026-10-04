# 01 — Kontrak data dan API aplikasi

Status: **usulan v1, belum diimplementasikan**. Baca [overview](README.md) terlebih dahulu. Semua URL di bawah adalah API aplikasi Next.js `/api/v1`, bukan URL REST bawaan Supabase. Transport internal SDK/RPC disepakati oleh kedua PIC.

## 1. Konvensi wajib

- Payload/DTO memakai `camelCase`; kolom PostgreSQL `snake_case`, dikonversi pada Route Handler/adapter.
- ID adalah UUID string. Jangan mengirim `employeeNo`, indeks array atau `Date.now()` sebagai foreign key.
- Role bisnis: `ADMIN_HR`, `MANAGER`, `EMPLOYEE`. Berbeda dari role DB Supabase `authenticated`/`anon`.
- `employmentStatus`: `ACTIVE`, `INACTIVE`. `accountStatus`: `INVITED`, `ACTIVE`, `DISABLED`.
- Cuti: `ANNUAL`, `PERMISSION`, `SICK`; keputusan: `PENDING`, `APPROVED`, `REJECTED`.
- Payroll: `DRAFT`, `PUBLISHED`. Tidak membuat status cancel/reopen tanpa revisi kontrak.
- Tanggal: `YYYY-MM-DD`; periode: `YYYY-MM`; timestamp: ISO 8601 UTC, misalnya `2026-10-05T01:00:00Z`.
- Field uang berakhiran `Idr`, integer 0–1.000.000.000.000 per komponen. Hitungan server wajib aman dari overflow dan potongan melebihi bruto. Jangan mengirim string `Rp`, pemisah ribuan atau pecahan float.
- String wajib di-trim; batas nama 150, nomor induk 30, telepon 8–20 karakter, alamat/alasan/catatan 1–2.000 karakter. Email dinormalisasi tanpa membedakan kapital. Tanggal harus valid secara kalender, bukan sekadar cocok pola.
- Request tidak boleh menentukan pemilik, approver, role aktif, waktu server, jumlah hari cuti atau total gaji bersih. Field yang tidak dikenal ditolak, bukan diteruskan ke DB dengan mass assignment.
- `version` integer pada record mutable dipakai optimistic locking. Request update membawa `expectedVersion`; konflik mengembalikan 409. Output berisi version terbaru. Untuk create tidak perlu version.

## 2. Session dan keamanan transport

Frontend MVP memanggil API same-origin dengan cookie session yang dikelola server menggunakan Supabase SSR. Login bukan dropdown role. Handler memverifikasi identitas (sesuai panduan `getClaims()` atau pemeriksaan `getUser()` yang tepat), kemudian membaca role/status terkini dari DB. `getSession()` saja atau role dari request/user_metadata tidak cukup untuk otorisasi.

Usulan MVP: auth server-only; belum memerlukan SDK Supabase di browser. Konfigurasi cookie HttpOnly, Secure pada HTTPS dan SameSite yang sesuai harus diuji, bukan diasumsikan otomatis dari SDK. Jika kelak browser SDK diperlukan, review ulang pengaturan cookie/refresh bersama. Implementasikan refresh session sesuai panduan resmi, propagasikan cookie request/response, jangan cache respons session/data HR untuk pengguna lain.

Mutation berbasis cookie harus memiliki perlindungan CSRF yang disepakati (token tervalidasi + pemeriksaan Origin same-origin); Content-Type JSON dan SameSite bukan satu-satunya kontrol. Auth callback memiliki validasi state/PKCE dan redirect allowlist. Akses database biasa memakai publishable key + JWT pengguna; admin/secret key hanya untuk operasi administratif terisolasi yang sudah memverifikasi HR.

## 3. Envelope dan error

Semua respons JSON sukses memakai `data` + `meta.requestId`. List juga memiliki `page`, `pageSize`, `total`, `totalPages`. Respons error tidak mempunyai `data`, melainkan `error` + `meta.requestId`.

```json
{
  "data": [],
  "meta": {
    "requestId": "req-demo-001",
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Periksa kembali data pengajuan",
    "fieldErrors": { "endDate": ["Tidak boleh sebelum tanggal mulai"] }
  },
  "meta": { "requestId": "req-demo-002" }
}
```

| HTTP    | Code aplikasi                                                                    | Makna/frontend                                                 |
| ------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 400     | `INVALID_QUERY`, `INVALID_JSON`                                                  | Parameter/query/body tidak dapat dibaca                        |
| 401     | `UNAUTHENTICATED`                                                                | Session tidak ada/invalid; minta login                         |
| 401     | `INVALID_CREDENTIALS`                                                            | Pesan login generik, jangan membocorkan apakah email terdaftar |
| 403     | `FORBIDDEN`, `ACCOUNT_DISABLED`, `EMPLOYEE_INACTIVE`, `ACCOUNT_NOT_ACTIVE`       | Identitas valid tetapi aksi/akun tidak diizinkan               |
| 404     | `NOT_FOUND`                                                                      | Record tidak ada atau tidak terlihat dalam lingkup pemohon     |
| 409     | `DUPLICATE_EMPLOYEE_NO`, `DUPLICATE_EMAIL`, `DUPLICATE_NAME`, `VERSION_CONFLICT` | Konflik data; jangan menimpa diam-diam                         |
| 409     | `ALREADY_CHECKED_IN`, `ALREADY_CHECKED_OUT`, `CHECK_IN_REQUIRED`                 | Urutan/status presensi konflik                                 |
| 409     | `LEAVE_OVERLAP`, `LEAVE_BALANCE_EXCEEDED`, `LEAVE_ALREADY_DECIDED`               | Konflik aturan cuti                                            |
| 409     | `PAYROLL_ALREADY_PUBLISHED`, `DUPLICATE_PERIOD`                                  | Periode/status tidak dapat diubah                              |
| 422     | `VALIDATION_ERROR`                                                               | Field/aturan nilai tidak valid; tampilkan fieldErrors          |
| 429     | `RATE_LIMITED`                                                                   | Batasi retry; ikuti Retry-After jika tersedia                  |
| 500/503 | `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`                                          | Pesan aman + requestId, bukan stack/SQL/token                  |

401/403 tidak diubah menjadi list kosong. Detail ID milik orang lain mengembalikan 404 agar keberadaan record tidak dibocorkan. Larangan fitur per role (misalnya Manager membuka payroll) tetap 403. Ekspor CSV tidak memakai envelope JSON saat sukses; error tetap JSON.

## 4. Pagination dan query

List: `page=1`, `pageSize=20` (maksimum 100), `q` maksimum 100 karakter, sort default stabil dengan ID sebagai tie-breaker. Sort hanya allowlist, bukan interpolasi SQL. `total` hanya menghitung record yang pemohon boleh lihat. Filter tidak dapat memperluas scope Manager/Karyawan.

- Karyawan: `q`, `departmentId`, `employmentStatus`, `sort=fullName`, `order=asc|desc`.
- Absensi: `date` (default tanggal Jakarta server), `employeeId` opsional dalam scope. Karyawan selalu sendiri.
- Cuti: `status`, `year`, `employeeId` opsional dalam scope; default seluruh pengajuan terlihat, newest-first.
- Kinerja/payroll: `period=YYYY-MM` wajib untuk query periode.
- `GET /me/leave-balance?year=2026`: tahun wajib integer dalam rentang kebijakan yang disepakati; tidak menerima employeeId.

## 5. Operasi yang harus tersedia

Kode akses: **HR** Admin HR aktif, **M** Manager aktif, **E** Karyawan aktif, **S** semua role aktif untuk diri sendiri. Semua operasi data memeriksa status akun DAN karyawan.

| Method/path setelah `/api/v1`                      | Pemohon                          | Input utama                                           | Hasil/aturan                                                                             |
| -------------------------------------------------- | -------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| POST `/auth/login`                                 | Belum login                      | email, password                                       | 200 session cookie + Me; tidak menerima role                                             |
| POST `/auth/logout`                                | Semua                            | kosong                                                | 200 `{ signedOut: true }`, hapus session browser                                         |
| POST `/auth/password-reset`                        | Belum login                      | email                                                 | 200 pesan generik, rate limit; email recovery Supabase                                   |
| GET `/auth/callback`                               | Flow Auth                        | code/state sesuai SDK                                 | Redirect allowlisted; endpoint ini tidak memakai envelope JSON                           |
| POST `/auth/password`                              | Flow recovery/invite tervalidasi | password baru                                         | 200; flow/identitas diverifikasi server, bukan flag dari body                            |
| GET `/me`                                          | S                                | —                                                     | Me dengan role/status DB terbaru + profil sendiri                                        |
| PATCH `/me/contact`                                | S                                | phone, address, expectedVersion (contact.version)     | Profil sendiri; field lainnya ditolak                                                    |
| GET `/dashboard`                                   | S                                | period                                                | Ringkasan dalam scope, bukan jumlah karyawan aktif sebagai jumlah hadir                  |
| GET `/employees`                                   | HR/M                             | query list                                            | EmployeeSummary; M hanya departemennya                                                   |
| GET `/employees/{id}`                              | HR/M/pemilik                     | UUID                                                  | DTO sesuai hak field, lihat Bagian 6                                                     |
| POST `/employees`                                  | HR                               | data karyawan + baseSalaryIdr                         | 201 EmployeeAdmin, transaksi inti/kontak/kompensasi; tidak otomatis membuat akun Auth    |
| PATCH `/employees/{id}`                            | HR                               | perubahan allowlist + expectedVersion                 | EmployeeAdmin; email akun terhubung tidak diubah melalui endpoint ini                    |
| GET `/departments`, `/positions`                   | S                                | query list                                            | ID/nama/status; jumlah anggota hanya jika scope-nya aman                                 |
| POST `/departments`, `/positions`                  | HR                               | name                                                  | 201 master unik                                                                          |
| PATCH `/departments/{id}`, `/positions/{id}`       | HR                               | name, expectedVersion                                 | Rename, FK karyawan tetap sama                                                           |
| GET `/attendance`                                  | S                                | query absensi                                         | Record tersimpan yang terlihat; frontend menampilkan missing sebagai belum absen         |
| POST `/attendance/check-in`                        | S                                | kosong                                                | 201; employee/date/timestamp dari server, sekali per hari                                |
| POST `/attendance/check-out`                       | S                                | kosong                                                | 200; harus sudah masuk hari ini, belum keluar                                            |
| GET `/me/leave-balance`                            | S                                | year                                                  | entitlement, used, reserved, available dalam hari kerja                                  |
| GET `/leave-requests`                              | S                                | query cuti                                            | HR semua, M tim, E sendiri                                                               |
| POST `/leave-requests`                             | E                                | type, startDate, endDate, reason                      | 201 PENDING; kuota/bentrok dihitung atomik                                               |
| POST `/leave-requests/{id}/decision`               | M                                | decision, rejectionReason?, expectedVersion           | APPROVED/REJECTED; tim sendiri, bukan dirinya                                            |
| GET `/payroll-runs`                                | HR/E                             | period                                                | HR draft/terbit; E hanya periode terbit yang mempunyai item dirinya                      |
| POST `/payroll-runs`                               | HR                               | period                                                | 201 DRAFT dan item karyawan aktif, default tunjangan/bonus/potongan 0                    |
| GET `/payroll-runs/{id}/items`                     | HR/E                             | query list                                            | HR semua item; E hanya item sendiri bila terbit                                          |
| PATCH `/payroll-items/{id}`                        | HR                               | allowanceIdr, bonusIdr, deductionIdr, expectedVersion | Draft saja; tidak menerima salarySnapshot/net/employeeId                                 |
| POST `/payroll-runs/{id}/publish`                  | HR                               | expectedVersion                                       | Validasi/snapshot seluruh item dan terbitkan dalam satu transaksi                        |
| GET `/payroll-items/{id}/payslip`                  | HR/E                             | UUID                                                  | HR dapat preview bertanda draft, E hanya own published                                   |
| GET `/performance-reviews`                         | S                                | period, query list                                    | HR semua, M tim, E sendiri; periode kosong tidak diwarisi                                |
| PUT `/employees/{id}/performance-reviews/{period}` | M                                | score, notes, expectedVersion?                        | 201 baru/200 edit; tidak self-review; existing membutuhkan expectedVersion               |
| GET `/accounts`                                    | HR                               | query list                                            | Akun + employeeNo + role + status, tidak ada password/token                              |
| POST `/accounts/invite`                            | HR                               | employeeId, role; Idempotency-Key                     | 202 Account INVITED setelah Auth + profile terhubung; bukan jaminan email sudah diterima |
| PATCH `/accounts/{userId}`                         | HR                               | role?, accountStatus?, expectedVersion                | ACTIVE/DISABLED; tidak self-demote/disable atau menghilangkan HR aktif terakhir          |
| GET `/reports/{kind}`                              | HR; E hanya payroll sendiri      | query sesuai modul                                    | CSV dalam scope; kind allowlist employees/attendance/leave/payroll/performance           |

Manager tidak mempunyai payroll/report finansial, termasuk miliknya sendiri sesuai PRD saat ini. HR/Manager belum memiliki aksi mengajukan cuti pada MVP ini; perlu revisi scope bila self-service semua role diperlukan. Tidak menambahkan hard delete, edit presensi, pembatalan cuti, reopen payroll atau custom email akun pada v1.

Body POST employees wajib: `employeeNo`, `fullName`, `workEmail`, `departmentId`, `positionId`, `employmentStatus`, `joinedOn`, `phone`, `address`, `baseSalaryIdr`. PATCH menerima subset field tersebut + `expectedVersion` dari EmployeeSummary.version, dengan pengecualian email akun yang sudah terhubung (ditolak 422 sampai flow perubahan email tersedia). Update contact/compensation melalui HR ikut menaikkan version aggregate employee. Body master: name; body performance: score, notes dan expectedVersion jika revisi. Password baru memakai field `password` dan harus memenuhi policy Auth yang disepakati; login hanya email/password.

Invite membutuhkan Idempotency-Key UUID per aksi: retry dengan key dan payload sama mengembalikan hasil yang sudah tercatat setelah otorisasi HR terkini diperiksa ulang; payload berbeda untuk key sama ditolak 409 `IDEMPOTENCY_CONFLICT`. Bila operasi masih diproses, return 409 `OPERATION_IN_PROGRESS`; frontend menunggu dan mencoba key yang sama, bukan membuat key baru. Simpan bookkeeping provisioning secara privat dengan masa retensi yang disepakati, lihat tabel operation_requests pada rancangan database. Jika Auth/profile gagal tersambung, return 503 aman + requestId, bukan Account ACTIVE palsu; backend merekonsiliasi state sebelum retry. Jangan menerapkan retry otomatis pada mutation lain tanpa strategi idempotency; UI refetch dahulu setelah hasil network yang tidak pasti.

## 6. DTO dan privasi field

| DTO               | Field                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Master            | id, name, status, version                                                                                                                                                            |
| EmployeeSummary   | id, employeeNo, fullName, workEmail, department `{ id, name }`, position `{ id, name }`, employmentStatus, joinedOn, version                                                         |
| EmployeeProfile   | EmployeeSummary + contact `{ phone, address, version }`; HR atau pemilik                                                                                                             |
| EmployeeAdmin     | EmployeeProfile + compensation `{ baseSalaryIdr, version }`; HR saja                                                                                                                 |
| Me                | userId, role, accountStatus, employee (EmployeeProfile)                                                                                                                              |
| Attendance        | id, employeeId, workDate, checkInAt, checkOutAt (nullable), status PRESENT/LATE, version                                                                                             |
| LeaveBalance      | year, entitlementDays, usedDays, reservedDays, availableDays                                                                                                                         |
| LeaveRequest      | id, employeeId, type, startDate, endDate, workingDays, reason, status, submittedAt, decidedBy (nullable), decidedAt (nullable), rejectionReason (nullable), version                  |
| PayrollRun        | id, period, status, publishedAt (nullable), publishedBy (nullable), version                                                                                                          |
| PayrollItem       | id, payrollRunId, employeeId, employeeNo, fullName, departmentName, positionName, baseSalaryIdr, allowanceIdr, bonusIdr, deductionIdr, netSalaryIdr, status DRAFT/PUBLISHED, version |
| PerformanceReview | id, employeeId, period, score, notes, assessedBy, assessedAt, version                                                                                                                |
| Account           | userId, employeeId, employeeNo, workEmail, role, accountStatus, version                                                                                                              |

EmployeeSummary tidak mengandung alamat, telepon, gaji, skor atau akun Auth userId. Manager yang membuka detail orang lain tetap mendapat EmployeeSummary, bukan EmployeeProfile/EmployeeAdmin. Me tidak mengandung gaji. Jangan memasukkan nilai gaji 0 sebagai pengganti field terlarang; hilangkan field/DTO finansialnya.

Dalam PayrollItem published, nama/jabatan/departemen/gaji merupakan snapshot saat publish. Draft dapat menampilkan data terkini dengan label draft. `netSalaryIdr` dihitung server, bukan diterima dari frontend. List respons boleh menambahkan ringkasan nama karyawan yang memang terlihat untuk rendering, tetapi tidak menambahkan field privat.

Contoh `/me` (seluruh identitas fiktif):

```json
{
  "data": {
    "userId": "a0000000-0000-4000-8000-000000000002",
    "role": "EMPLOYEE",
    "accountStatus": "ACTIVE",
    "employee": {
      "id": "e0000000-0000-4000-8000-000000000002",
      "employeeNo": "EMP-002",
      "fullName": "Rizky Pratama",
      "workEmail": "rizky.pratama@example.test",
      "department": {
        "id": "d0000000-0000-4000-8000-000000000001",
        "name": "Engineering"
      },
      "position": {
        "id": "b0000000-0000-4000-8000-000000000001",
        "name": "Frontend Developer"
      },
      "employmentStatus": "ACTIVE",
      "joinedOn": "2025-01-06",
      "contact": {
        "phone": "081200000002",
        "address": "Alamat contoh",
        "version": 1
      },
      "version": 1
    }
  },
  "meta": { "requestId": "req-demo-me" }
}
```

Contoh body POST cuti:

```json
{
  "type": "ANNUAL",
  "startDate": "2026-10-12",
  "endDate": "2026-10-13",
  "reason": "Keperluan keluarga"
}
```

Contoh keputusan penolakan dan edit payroll:

```json
{
  "decision": "REJECTED",
  "rejectionReason": "Jadwal tim belum memungkinkan",
  "expectedVersion": 1
}
```

```json
{
  "allowanceIdr": 500000,
  "bonusIdr": 250000,
  "deductionIdr": 0,
  "expectedVersion": 1
}
```

## 7. Dashboard dan laporan

Dashboard period wajib, tanggal hari ini berasal dari server. DTO yang diusulkan: `scope` ORGANIZATION/DEPARTMENT/SELF, `period`, `workDate`, `employeeCount`, `activeEmployeeCount`, `presentCount`, `pendingLeaveCount`, `averageReviewScore` nullable, `reviewedEmployeeCount`, `departmentDistribution`, `recentLeaveRequests`. Untuk E tambahkan `myAttendance` nullable dan `leaveBalance`; ringkasan payroll hanya HR (`payrollSummary`), bukan M. Semua agregasi menggunakan lingkup akses yang sama dengan list/detail.

Ringkasan mingguan di frontend sekarang masih ilustrasi. Backend tidak boleh mengirim angka ilustrasi sebagai hasil DB. Grafik nyata perlu kontrak series terpisah yang disetujui; sampai tersedia, label ilustrasi tetap ditampilkan atau grafik disembunyikan.

CSV: scope/filter sama dengan list; payroll E hanya own published dan periode wajib. Header `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment` dengan nama aman; quote/escape dan netralisasi formula. Batasi ekspor MVP maksimum 10.000 baris; jika lebih, kembalikan 422 dan minta mempersempit filter, jangan diam-diam memotong hasil. Ekspor employee memakai EmployeeSummary saja; laporan gaji terpisah. Jangan cache respons HR/data session secara publik.

## 8. Mapping demo → integrasi

| Frontend sekarang           | Kontrak v1                                  | Penyesuaian frontend                                      |
| --------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| Person.id angka, Date.now   | UUID string                                 | Ubah type/state/key; jangan memaksa UUID menjadi number   |
| name/email/dept/position    | fullName/workEmail + master ID/DTO          | Adapter label dan dropdown master ID                      |
| salary dalam setiap Person  | compensation HR / PayrollItem own published | Pisahkan model; jangan mengirim Person lengkap ke Manager |
| score dalam Person          | PerformanceReview per employee/period       | Query terpisah, kosong berarti belum dinilai              |
| phone/address di detail tim | Contact hanya HR/pemilik                    | Sembunyikan di detail anggota tim Manager                 |
| joinDate                    | joinedOn                                    | Format date tetap YYYY-MM-DD                              |
| role/status teks Indonesia  | enum kontrak                                | Label Indonesia hanya pada UI                             |
| September 2026              | 2026-09                                     | Konversi di adapter periode, bukan di DB                  |
| checkIn/checkOut HH:mm      | timestamp UTC                               | Format WIB pada tampilan, jangan mengirim jam browser     |
| processedPeriods di memori  | PayrollRun.status                           | Ambil status server dan refetch setelah publish           |
| saldo cuti hitungan browser | LeaveBalance server                         | UI hitung preview boleh; keputusan server wajib           |
| accountRoles dropdown       | Role DB terproteksi                         | Hilangkan pemilihan role login nyata                      |

Gunakan adapter/service per modul, tidak menaruh semua fetch di file `app/hris-app.tsx`. Template DTO/form schemas dan OpenAPI dapat dibuat setelah kontrak v1 disetujui; paket ini belum mengklaim mempunyai OpenAPI yang executable.

## Referensi resmi

Rancangan DTO/endpoint merupakan keputusan proyek. Dasar session/keys: [Supabase SSR Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs), [API keys](https://supabase.com/docs/guides/getting-started/api-keys). Hak akses DB dijelaskan di [dokumen RLS proyek](03_ACCESS_AND_RLS.md).
