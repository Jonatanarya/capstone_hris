# DOKUMEN PERENCANAAN SISTEM HRIS

## Human Resource Information System (HRIS) Berbasis Web untuk Pengelolaan Data dan Aktivitas Karyawan

---

## 1. Pendahuluan

Dokumen ini merupakan perencanaan awal untuk perancangan dan implementasi **Human Resource Information System (HRIS)** berbasis web.

Berdasarkan materi tugas Capstone Project, pengajuan awal terdiri dari:

1. **Perencanaan**, yaitu mendeskripsikan sistem yang akan dirancang dan diimplementasikan.
2. **Perancangan secara detail**, yang meliputi:
   - Use Case Diagram
   - Activity Diagram
   - Sequence Diagram
   - Class Diagram

Kelompok yang mendapat topik **Human Resource Information System (HRIS)** diarahkan untuk merancang sistem yang berhubungan dengan pengelolaan sumber daya manusia. Pada materi, HRIS digambarkan memiliki cakupan seperti attendance, payroll, recruitment, career and development, performance management, employee management, benefits, serta HR dashboard analytics.

Dalam dokumen ini, ruang lingkup sistem dibatasi agar sesuai dengan kebutuhan tugas dan realistis untuk diimplementasikan.

---

## 2. Judul Sistem

**Perancangan dan Implementasi Human Resource Information System (HRIS) Berbasis Web untuk Pengelolaan Data dan Aktivitas Karyawan**

---

## 3. Latar Belakang

Pengelolaan sumber daya manusia merupakan salah satu aktivitas penting dalam sebuah organisasi atau perusahaan. Proses tersebut mencakup pengelolaan data karyawan, pencatatan absensi, pengajuan cuti, penggajian, penilaian kinerja, serta penyusunan laporan sumber daya manusia.

Apabila proses pengelolaan tersebut masih dilakukan secara manual atau menggunakan beberapa media yang terpisah, dapat muncul berbagai permasalahan, seperti data yang tidak terpusat, proses pencarian data yang lambat, risiko duplikasi data, kesulitan dalam melakukan rekapitulasi, serta keterlambatan dalam proses administrasi.

Untuk mengatasi permasalahan tersebut, dirancang sebuah **Human Resource Information System (HRIS)** berbasis web yang dapat membantu proses pengelolaan sumber daya manusia secara terintegrasi.

Sistem ini dirancang agar bagian HR dapat mengelola data karyawan dan administrasi sumber daya manusia, manager dapat melakukan pengawasan dan persetujuan terkait aktivitas karyawan, serta karyawan dapat mengakses informasi yang berkaitan dengan dirinya sendiri.

---

## 4. Deskripsi Sistem

Human Resource Information System (HRIS) yang akan dirancang merupakan aplikasi berbasis web yang digunakan untuk membantu pengelolaan data dan aktivitas sumber daya manusia secara terpusat.

Sistem memiliki tiga jenis pengguna utama, yaitu:

1. **Admin HR**
2. **Manager / Supervisor**
3. **Karyawan**

Sistem akan memiliki enam modul utama:

1. Employee Management
2. Attendance Management
3. Leave Management
4. Payroll Management
5. Performance Management
6. HR Dashboard & Report

Setiap pengguna memiliki hak akses yang berbeda sesuai dengan perannya.

Admin HR bertanggung jawab terhadap pengelolaan data utama HR. Manager bertanggung jawab terhadap pengawasan anggota tim, persetujuan cuti, dan penilaian kinerja. Karyawan menggunakan sistem untuk mengakses data pribadi, melakukan absensi, mengajukan cuti, melihat slip gaji, dan melihat hasil penilaian.

---

## 5. Identifikasi Masalah

Permasalahan yang menjadi dasar perancangan sistem adalah:

1. Data karyawan belum dikelola secara terpusat.
2. Proses pencatatan dan pemantauan absensi belum terintegrasi.
3. Proses pengajuan dan persetujuan cuti masih memerlukan administrasi yang cukup panjang.
4. Informasi penggajian belum dapat diakses secara mandiri oleh karyawan.
5. Penilaian kinerja karyawan belum terdokumentasi secara terpusat.
6. Pembuatan laporan HR membutuhkan proses rekapitulasi data yang berulang.
7. Manager membutuhkan akses informasi yang berkaitan dengan anggota timnya.
8. Risiko duplikasi dan ketidakkonsistenan data lebih besar apabila data dikelola pada beberapa media yang berbeda.

---

## 6. Tujuan Sistem

Tujuan perancangan dan implementasi HRIS adalah:

1. Menyediakan penyimpanan data karyawan secara terpusat.
2. Mempermudah Admin HR dalam mengelola data karyawan.
3. Mempermudah proses pencatatan dan pemantauan absensi.
4. Menyediakan proses pengajuan dan persetujuan cuti secara digital.
5. Membantu pengelolaan data payroll.
6. Memberikan akses kepada karyawan untuk melihat slip gaji.
7. Membantu manager melakukan penilaian kinerja karyawan.
8. Menyediakan informasi dan laporan HR yang dapat digunakan untuk monitoring.
9. Mengurangi kemungkinan terjadinya duplikasi dan ketidakkonsistenan data.
10. Meningkatkan efisiensi proses administrasi sumber daya manusia.

---

## 7. Ruang Lingkup Sistem

### 7.1 Employee Management

Modul Employee Management digunakan untuk mengelola data karyawan.

Data yang dikelola antara lain:

- Nomor induk karyawan
- Nama karyawan
- Email
- Nomor telepon
- Alamat
- Tanggal masuk
- Departemen
- Jabatan
- Status karyawan
- Akun pengguna

Fungsi utama:

- Menambahkan data karyawan
- Melihat data karyawan
- Mengubah data karyawan
- Mengelola status karyawan
- Mengelola departemen
- Mengelola jabatan
- Melihat profil pribadi

---

### 7.2 Attendance Management

Modul Attendance Management digunakan untuk mencatat dan memantau kehadiran karyawan.

Data yang dikelola:

- Tanggal absensi
- Waktu masuk
- Waktu keluar
- Status kehadiran
- Riwayat absensi

Fungsi utama:

- Absensi masuk
- Absensi keluar
- Melihat riwayat absensi
- Melihat data absensi seluruh karyawan
- Melihat data absensi anggota divisi
- Membuat rekap absensi

---

### 7.3 Leave Management

Modul Leave Management digunakan untuk mengelola proses pengajuan cuti karyawan.

Data yang dikelola:

- Jenis cuti
- Tanggal mulai
- Tanggal selesai
- Alasan cuti
- Tanggal pengajuan
- Status pengajuan
- Pihak yang memberikan persetujuan

Status pengajuan:

- Pending
- Approved
- Rejected

Alur utama:

```text
Karyawan mengajukan cuti
        ↓
Sistem menyimpan pengajuan
        ↓
Status = Pending
        ↓
Manager melakukan review
        ↓
Approve / Reject
        ↓
Sistem memperbarui status
        ↓
Karyawan melihat hasil pengajuan
```

---

### 7.4 Payroll Management

Modul Payroll Management digunakan untuk mengelola informasi penggajian karyawan.

Komponen payroll:

```text
Gaji Pokok
+ Tunjangan
+ Bonus
- Potongan
= Total Gaji
```

Data yang dikelola:

- Periode gaji
- Gaji pokok
- Tunjangan
- Bonus
- Potongan
- Total gaji

Fungsi utama:

- Membuat data payroll
- Mengubah data payroll
- Melihat data payroll
- Melihat slip gaji

---

### 7.5 Performance Management

Modul Performance Management digunakan untuk mencatat penilaian kinerja karyawan.

Data yang dikelola:

- Periode penilaian
- Karyawan yang dinilai
- Nilai kinerja
- Catatan manager
- Tanggal penilaian

Fungsi utama:

- Manager memberikan penilaian
- Manager memberikan catatan
- Admin HR melihat data penilaian
- Karyawan melihat hasil penilaian

---

### 7.6 HR Dashboard & Report

Modul Dashboard & Report digunakan untuk menampilkan ringkasan informasi HR dan menghasilkan laporan.

Informasi yang dapat ditampilkan:

- Jumlah karyawan
- Jumlah karyawan berdasarkan departemen
- Jumlah karyawan hadir
- Jumlah karyawan cuti
- Jumlah pengajuan cuti
- Ringkasan absensi
- Ringkasan payroll
- Ringkasan penilaian kinerja

Laporan yang tersedia:

- Laporan data karyawan
- Laporan absensi
- Laporan cuti
- Laporan payroll
- Laporan penilaian kinerja

---

## 8. Aktor Sistem

| Aktor | Deskripsi |
|---|---|
| Admin HR | Pengguna yang bertanggung jawab mengelola data dan administrasi sumber daya manusia. |
| Manager / Supervisor | Pengguna yang bertanggung jawab mengawasi anggota tim, melakukan persetujuan cuti, dan memberikan penilaian kinerja. |
| Karyawan | Pengguna yang menggunakan layanan HRIS untuk kebutuhan pribadi seperti absensi, cuti, slip gaji, dan penilaian. |

---

## 9. Hak Akses Pengguna

### 9.1 Admin HR

Admin HR dapat:

- Login
- Logout
- Melihat dashboard
- Mengelola data karyawan
- Mengelola departemen
- Mengelola jabatan
- Mengelola data absensi
- Melihat dan mengelola pengajuan cuti
- Mengelola payroll
- Melihat data penilaian
- Melihat laporan
- Mengelola akun pengguna

---

### 9.2 Manager / Supervisor

Manager dapat:

- Login
- Logout
- Melihat dashboard manager
- Melihat anggota divisi
- Melihat absensi anggota divisi
- Melihat pengajuan cuti
- Menyetujui pengajuan cuti
- Menolak pengajuan cuti
- Memberikan penilaian kinerja
- Melihat riwayat penilaian

---

### 9.3 Karyawan

Karyawan dapat:

- Login
- Logout
- Melihat profil
- Melakukan absensi masuk
- Melakukan absensi keluar
- Melihat riwayat absensi
- Mengajukan cuti
- Melihat status pengajuan cuti
- Melihat riwayat cuti
- Melihat slip gaji
- Melihat hasil penilaian kinerja

---

## 10. Kebutuhan Fungsional

### 10.1 Authentication

| ID | Kebutuhan |
|---|---|
| FR-01 | Sistem harus dapat melakukan proses login pengguna. |
| FR-02 | Sistem harus dapat membedakan hak akses berdasarkan role pengguna. |
| FR-03 | Sistem harus dapat melakukan proses logout. |

### 10.2 Employee Management

| ID | Kebutuhan |
|---|---|
| FR-04 | Admin HR dapat menambahkan data karyawan. |
| FR-05 | Admin HR dapat melihat data karyawan. |
| FR-06 | Admin HR dapat mengubah data karyawan. |
| FR-07 | Admin HR dapat mengelola status karyawan. |
| FR-08 | Admin HR dapat mengelola data departemen. |
| FR-09 | Admin HR dapat mengelola data jabatan. |
| FR-10 | Karyawan dapat melihat profil miliknya. |

### 10.3 Attendance Management

| ID | Kebutuhan |
|---|---|
| FR-11 | Karyawan dapat melakukan absensi masuk. |
| FR-12 | Karyawan dapat melakukan absensi keluar. |
| FR-13 | Sistem mencatat waktu absensi. |
| FR-14 | Karyawan dapat melihat riwayat absensi. |
| FR-15 | Admin HR dapat melihat seluruh data absensi. |
| FR-16 | Manager dapat melihat data absensi anggota divisinya. |

### 10.4 Leave Management

| ID | Kebutuhan |
|---|---|
| FR-17 | Karyawan dapat mengajukan cuti. |
| FR-18 | Karyawan dapat melihat status pengajuan cuti. |
| FR-19 | Manager dapat melihat pengajuan cuti karyawan. |
| FR-20 | Manager dapat menyetujui pengajuan cuti. |
| FR-21 | Manager dapat menolak pengajuan cuti. |
| FR-22 | Sistem menyimpan riwayat pengajuan cuti. |

### 10.5 Payroll Management

| ID | Kebutuhan |
|---|---|
| FR-23 | Admin HR dapat membuat data payroll. |
| FR-24 | Admin HR dapat mengubah data payroll. |
| FR-25 | Admin HR dapat melihat data payroll. |
| FR-26 | Karyawan dapat melihat slip gaji. |

### 10.6 Performance Management

| ID | Kebutuhan |
|---|---|
| FR-27 | Manager dapat memberikan penilaian kinerja. |
| FR-28 | Manager dapat memberikan catatan penilaian. |
| FR-29 | Karyawan dapat melihat hasil penilaian. |
| FR-30 | Admin HR dapat melihat data penilaian kinerja. |

### 10.7 Dashboard & Report

| ID | Kebutuhan |
|---|---|
| FR-31 | Admin HR dapat melihat dashboard HR. |
| FR-32 | Admin HR dapat melihat laporan data karyawan. |
| FR-33 | Admin HR dapat melihat laporan absensi. |
| FR-34 | Admin HR dapat melihat laporan cuti. |
| FR-35 | Admin HR dapat melihat laporan payroll. |
| FR-36 | Admin HR dapat melihat laporan penilaian kinerja. |

---

## 11. Kebutuhan Non-Fungsional

| ID | Kebutuhan | Deskripsi |
|---|---|---|
| NFR-01 | Security | Pengguna harus melakukan autentikasi sebelum mengakses sistem. |
| NFR-02 | Authorization | Sistem membatasi akses fitur berdasarkan role pengguna. |
| NFR-03 | Usability | Antarmuka harus mudah dipahami dan digunakan. |
| NFR-04 | Responsive | Sistem dapat digunakan melalui komputer maupun perangkat mobile. |
| NFR-05 | Data Integrity | Sistem menjaga konsistensi data yang disimpan. |
| NFR-06 | Performance | Proses menampilkan dan menyimpan data memiliki waktu respons yang wajar. |
| NFR-07 | Maintainability | Struktur sistem dibuat terorganisasi agar mudah dikembangkan dan dipelihara. |

---

## 12. Gambaran Proses Bisnis

```text
                            HRIS
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          ADMIN HR         MANAGER         KARYAWAN
             │                │                │
     Kelola Karyawan      Lihat Tim          Profil
     Kelola Absensi       Lihat Absensi      Absensi
     Kelola Cuti          Approval Cuti      Ajukan Cuti
     Kelola Payroll       Penilaian          Status Cuti
     Kelola Laporan                          Slip Gaji
                                             Penilaian
```

---

## 13. Alur Sistem Secara Umum

### 13.1 Alur Login

```text
User
 ↓
Membuka Sistem HRIS
 ↓
Memasukkan Email dan Password
 ↓
Sistem Melakukan Validasi
 ↓
Apakah Data Benar?
 ├── Tidak → Tampilkan Pesan Error
 │
 └── Ya
     ↓
   Cek Role
     ↓
┌──────────┬──────────┬──────────┐
│          │          │
Admin HR  Manager   Karyawan
│          │          │
↓          ↓          ↓
Dashboard sesuai Role
```

### 13.2 Alur Absensi

```text
Karyawan Login
      ↓
Dashboard
      ↓
Pilih Menu Absensi
      ↓
Klik Absen Masuk
      ↓
Sistem mencatat waktu
      ↓
Data Absensi Disimpan
      ↓
Notifikasi Berhasil
      ↓
Riwayat Absensi Diperbarui
```

### 13.3 Alur Pengajuan Cuti

```text
Karyawan
   ↓
Login
   ↓
Menu Cuti
   ↓
Ajukan Cuti
   ↓
Isi Form
   ↓
Submit
   ↓
Status = Pending
   ↓
Manager Review
   ↓
┌───────────────┐
│               │
Approve       Reject
│               │
↓               ↓
Approved      Rejected
│               │
└───────┬───────┘
        ↓
Karyawan Melihat Status
```

### 13.4 Alur Payroll

```text
Admin HR
   ↓
Pilih Karyawan
   ↓
Pilih Periode
   ↓
Input Gaji Pokok
   ↓
Input Tunjangan
   ↓
Input Bonus
   ↓
Input Potongan
   ↓
Hitung Total Gaji
   ↓
Simpan Payroll
   ↓
Slip Gaji Tersedia
   ↓
Karyawan Melihat Slip Gaji
```

### 13.5 Alur Penilaian Kinerja

```text
Manager
   ↓
Login
   ↓
Pilih Anggota Tim
   ↓
Pilih Periode Penilaian
   ↓
Input Nilai
   ↓
Input Catatan
   ↓
Submit
   ↓
Data Disimpan
   ↓
Karyawan Melihat Hasil
```

---

## 14. Data Utama yang Dikelola

| No | Data | Fungsi |
|---|---|---|
| 1 | User | Menyimpan akun pengguna dan role. |
| 2 | Employee | Menyimpan data karyawan. |
| 3 | Department | Menyimpan data departemen. |
| 4 | Position | Menyimpan data jabatan. |
| 5 | Attendance | Menyimpan data absensi. |
| 6 | Leave | Menyimpan data pengajuan cuti. |
| 7 | Payroll | Menyimpan data penggajian. |
| 8 | Performance | Menyimpan data penilaian kinerja. |

---

## 15. Relasi Data Secara Konseptual

```text
Department
    │
    │ 1
    │
    │ *
Employee ───────── Position
   │
   ├──────── Attendance
   │
   ├──────── Leave
   │
   ├──────── Payroll
   │
   └──────── Performance
```

Relasi tersebut masih berupa gambaran konseptual dan akan dikembangkan lebih lanjut pada tahap **Class Diagram**.

---

## 16. Struktur Menu Sistem

### 16.1 Admin HR

```text
Dashboard

Master Data
├── Employees
├── Departments
└── Positions

Attendance
├── Attendance Records
└── Attendance Report

Leave
├── Leave Requests
└── Leave History

Payroll
├── Payroll Data
└── Payslip

Performance
├── Performance Reviews
└── Performance History

Reports

User Management

Logout
```

### 16.2 Manager / Supervisor

```text
Dashboard

My Team

Attendance

Leave Approval

Performance Review

Logout
```

### 16.3 Karyawan

```text
Dashboard

My Profile

Attendance
├── Check In
├── Check Out
└── Attendance History

Leave
├── Submit Leave
└── Leave History

My Payslip

My Performance

Logout
```

---

## 17. Batasan Sistem

Untuk menjaga ruang lingkup proyek agar realistis, beberapa fitur tidak menjadi fokus utama implementasi.

Sistem tidak membahas secara mendalam:

- Recruitment
- Psikotes
- Proses wawancara
- Training management
- Career development
- Benefits eksternal
- BPJS
- Perhitungan pajak payroll kompleks
- Integrasi bank
- Integrasi fingerprint
- Integrasi GPS
- Integrasi mesin absensi fisik

Fitur-fitur tersebut dapat dikembangkan pada tahap selanjutnya apabila sistem diperluas.

---


## 18. Rekomendasi Teknologi dan Arsitektur Sistem

### 18.1 Pendekatan Arsitektur

Untuk implementasi HRIS ini, arsitektur yang direkomendasikan adalah arsitektur web modern berbasis **frontend framework + Backend as a Service (BaaS)**. Pendekatan ini dipilih agar pengembangan lebih cepat, kebutuhan server lebih sederhana, dan tim dapat berfokus pada implementasi fitur HRIS.

Arsitektur yang direkomendasikan:

```text
Pengguna
   │
   ▼
Next.js Web Application
   │
   │ HTTPS
   ▼
Vercel
   │
   ├── Authentication
   ├── Server-side Logic / Route Handler
   └── Frontend Application
            │
            ▼
        Supabase
   ┌────────┼─────────┐
   │        │         │
PostgreSQL Auth    Storage
   │
   └── Row Level Security
```

Pada arsitektur ini, **Next.js** digunakan sebagai aplikasi web utama dan di-deploy menggunakan **Vercel**, sedangkan **Supabase** digunakan sebagai layanan backend untuk database, authentication, authorization, dan penyimpanan file.

---

### 18.2 Frontend

Teknologi frontend yang direkomendasikan:

| Teknologi | Penggunaan |
|---|---|
| Next.js | Framework utama aplikasi web |
| React | Membangun komponen antarmuka |
| TypeScript | Memberikan type safety dan membantu mengurangi kesalahan kode |
| Tailwind CSS | Styling dan pembuatan antarmuka responsif |
| shadcn/ui | Komponen antarmuka seperti form, dialog, tabel, dropdown, dan dashboard |
| React Hook Form | Pengelolaan form |
| Zod | Validasi data input |
| Recharts | Visualisasi data dashboard dan laporan |

Next.js dipilih karena dapat menangani kebutuhan frontend sekaligus menyediakan fitur server-side yang dapat digunakan untuk beberapa proses bisnis yang membutuhkan validasi atau keamanan tambahan.

---

### 18.3 Backend

Untuk proyek HRIS ini, backend direkomendasikan menggunakan **Supabase**.

Layanan Supabase yang digunakan:

| Layanan | Penggunaan |
|---|---|
| Supabase PostgreSQL | Database utama sistem HRIS |
| Supabase Auth | Login dan autentikasi pengguna |
| Row Level Security (RLS) | Pembatasan akses data berdasarkan role |
| Supabase Storage | Penyimpanan file seperti foto profil atau dokumen pendukung |
| Supabase Edge Functions | Digunakan apabila diperlukan proses backend khusus |

Tidak diperlukan server backend terpisah seperti Express.js atau NestJS pada tahap awal. Logika server yang sederhana dapat ditempatkan pada Next.js Server Actions / Route Handlers, sedangkan proses backend khusus dapat ditempatkan pada Supabase Edge Functions apabila diperlukan.

---

### 18.4 Database

Database yang direkomendasikan adalah **PostgreSQL** melalui Supabase.

Penggunaan database relasional sesuai dengan karakteristik data HRIS karena data memiliki banyak hubungan antarentitas.

Contoh hubungan:

```text
Department
     │
     └── Employee
            │
            ├── Attendance
            ├── Leave Request
            ├── Payroll
            └── Performance Review

Position
     │
     └── Employee
```

Dengan database relasional, hubungan tersebut dapat direpresentasikan menggunakan tabel, primary key, foreign key, constraint, dan query SQL.

Tabel utama yang direncanakan antara lain:

- users / profiles
- employees
- departments
- positions
- attendances
- leave_requests
- payrolls
- performance_reviews

---

### 18.5 Authentication dan Authorization

Sistem menggunakan authentication untuk memastikan pengguna telah login sebelum mengakses aplikasi.

Role utama:

```text
ADMIN_HR
MANAGER
EMPLOYEE
```

Setelah login, sistem melakukan pengecekan role untuk menentukan fitur dan data yang dapat diakses pengguna.

Contoh:

```text
Login
  ↓
Authentication
  ↓
Validasi User
  ↓
Cek Role
  │
  ├── ADMIN_HR → Dashboard HR
  ├── MANAGER  → Dashboard Manager
  └── EMPLOYEE → Dashboard Karyawan
```

Authorization terhadap data akan diperkuat menggunakan **Row Level Security (RLS)** sehingga pembatasan tidak hanya dilakukan pada tampilan frontend.

---

### 18.6 Deployment

Deployment aplikasi direncanakan menggunakan:

| Komponen | Platform |
|---|---|
| Frontend / Next.js | Vercel |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| File Storage | Supabase Storage |
| Server-side Function | Next.js / Supabase Edge Functions |
| Source Code | GitHub |

Alur deployment:

```text
Developer
    │
    ▼
 GitHub Repository
    │
    ▼
  Vercel
    │
    ▼
Next.js Application
    │
    ▼
 Supabase Backend
```

Setiap perubahan yang telah disimpan pada repository dapat digunakan sebagai bagian dari proses deployment aplikasi ke Vercel.

---

### 18.7 Rekomendasi Tech Stack Final

Tech stack utama yang direkomendasikan untuk implementasi HRIS adalah:

```text
Frontend
├── Next.js
├── React
├── TypeScript
├── Tailwind CSS
└── shadcn/ui

Form & Validation
├── React Hook Form
└── Zod

Backend Services
├── Supabase Auth
├── Supabase PostgreSQL
├── Supabase Storage
└── Supabase Edge Functions (jika diperlukan)

Dashboard
└── Recharts

Deployment
├── Vercel
└── GitHub

Development
├── Visual Studio Code
├── Node.js
└── Git
```

---

### 18.8 Alternatif Menggunakan Firebase

Firebase tetap dapat digunakan sebagai backend dan merupakan pilihan yang valid untuk membangun aplikasi HRIS.

Apabila Firebase digunakan, rancangan stack dapat berupa:

```text
Next.js
   │
   ├── Firebase Authentication
   ├── Cloud Firestore
   ├── Firebase Storage
   └── Cloud Functions
```

Firebase Authentication dapat digunakan untuk proses login, sedangkan Cloud Firestore digunakan untuk menyimpan data dalam bentuk document dan collection.

Namun, HRIS memiliki banyak data yang saling berelasi seperti Employee, Department, Position, Attendance, Leave, Payroll, dan Performance. Apabila menggunakan Firestore, hubungan tersebut harus dirancang menggunakan pendekatan database NoSQL.

Untuk proyek HRIS ini, database relasional dipilih sebagai rekomendasi utama karena lebih sesuai dengan model data yang telah dirancang pada Class Diagram dan ERD.

Jika tim tetap ingin menggunakan ekosistem Firebase namun membutuhkan database relasional, alternatifnya adalah menggunakan layanan relational PostgreSQL pada ekosistem Firebase (Firebase SQL Connect / Data Connect) daripada menjadikan Firestore sebagai database utama.

---

### 18.9 Keputusan Teknologi yang Direkomendasikan

Berdasarkan kebutuhan sistem HRIS, stack yang dipilih sebagai rekomendasi utama adalah:

**Next.js + TypeScript + Tailwind CSS + Supabase + Vercel**

Alasan pemilihan:

1. Next.js mendukung pengembangan aplikasi web modern dan cocok di-deploy pada Vercel.
2. TypeScript membantu menjaga konsistensi tipe data pada aplikasi.
3. Tailwind CSS mempercepat pembuatan tampilan responsif.
4. PostgreSQL cocok untuk data HRIS yang memiliki banyak hubungan antarentitas.
5. Supabase menyediakan database PostgreSQL, authentication, storage, dan authorization dalam satu platform.
6. Tim tidak perlu membangun dan mengelola server backend secara terpisah pada tahap awal.
7. Struktur database relasional lebih mudah disesuaikan dengan Class Diagram dan ERD yang akan dibuat pada tahap perancangan.
8. Arsitektur tetap dapat dikembangkan lebih lanjut apabila kebutuhan sistem bertambah.


## 19. Output Sistem

### 19.1 Employee Information

- Daftar karyawan
- Profil karyawan
- Informasi departemen
- Informasi jabatan

### 19.2 Attendance Information

- Riwayat absensi
- Rekap absensi

### 19.3 Leave Information

- Daftar pengajuan cuti
- Status cuti
- Riwayat cuti

### 19.4 Payroll Information

- Data payroll
- Slip gaji

### 19.5 Performance Information

- Nilai kinerja
- Catatan penilaian

### 19.6 HR Report

- Laporan karyawan
- Laporan absensi
- Laporan cuti
- Laporan payroll
- Laporan penilaian kinerja

---

## 20. Ringkasan Arsitektur Fungsional

```text
HRIS
│
├── Authentication & User Management
│
├── Employee Management
│   ├── Employee
│   ├── Department
│   └── Position
│
├── Attendance Management
│
├── Leave Management
│
├── Payroll Management
│
├── Performance Management
│
└── Dashboard & Report
```

---

## 21. Kesimpulan

Human Resource Information System (HRIS) yang dirancang merupakan aplikasi berbasis web yang digunakan untuk membantu pengelolaan data dan aktivitas sumber daya manusia secara terintegrasi.

Sistem memiliki tiga aktor utama, yaitu:

1. Admin HR
2. Manager / Supervisor
3. Karyawan

Ruang lingkup implementasi difokuskan pada enam modul utama:

1. Employee Management
2. Attendance Management
3. Leave Management
4. Payroll Management
5. Performance Management
6. HR Dashboard & Report

Dokumen perencanaan ini akan digunakan sebagai dasar untuk tahap perancangan selanjutnya, yaitu pembuatan:

- Use Case Diagram
- Activity Diagram
- Sequence Diagram
- Class Diagram

Dengan adanya perencanaan ini, proses perancangan diagram dan implementasi sistem dapat dilakukan secara lebih terstruktur dan konsisten.

---

## 22. Tahap Perancangan Selanjutnya

Tahapan setelah dokumen perencanaan ini adalah:

```text
Perencanaan Sistem HRIS
        ↓
Use Case Diagram
        ↓
Activity Diagram
        ↓
Sequence Diagram
        ↓
Class Diagram
        ↓
Perancangan Database / ERD
        ↓
Perancangan Antarmuka
        ↓
Implementasi Sistem
        ↓
Pengujian Sistem
```

---

**Catatan:** Dokumen ini merupakan rancangan ruang lingkup HRIS untuk kebutuhan Capstone Project. Cakupan sistem telah disederhanakan dari gambaran HRIS pada materi agar dapat dirancang dan diimplementasikan secara realistis.

---

## 23. Penyempurnaan Hasil Validasi Frontend (4 Oktober 2026)

Bagian 1–22 tetap menjadi ruang lingkup sistem tujuan. Tambahan ini memperjelas kebijakan demo, kriteria penerimaan, dan pemisahan frontend dari sistem produksi. Aturan 12 hari cuti, jam 08.00–17.00, serta hari kerja Senin–Jumat adalah asumsi demonstrasi yang harus disetujui organisasi dan dibuat dapat dikonfigurasi saat implementasi backend; bukan pernyataan ketentuan hukum.

### 23.1 Batas Tahap Implementasi

Frontend menggunakan Next.js resmi, React, TypeScript, Tailwind CSS dan shadcn. Node.js adalah runtime pengembangan/build/server, bukan framework alternatif dari Next.js. Tahap ini tidak membutuhkan server Express terpisah. Infrastruktur Supabase (PostgreSQL, Auth, RLS) tetap direncanakan untuk tahap berikutnya.

Pemilihan peran, login, pengaturan akun, presensi, penerbitan payroll, dan penilaian saat ini adalah simulasi menggunakan data fiktif di memori. Refresh mengembalikan data awal. Pembatasan tampilan bukan otorisasi yang aman; jangan memasukkan data personal atau gaji nyata ke demo publik. Vercel menangani hosting, sementara autentikasi nantinya ditangani Supabase Auth, bukan oleh hosting itu sendiri.

### 23.2 Matriks Akses dan Kepemilikan

| Data/aksi | Admin HR | Manager | Karyawan |
|---|---|---|---|
| Data karyawan | Seluruh data, tambah/edit/nonaktif | Baca anggota departemen sendiri | Profil sendiri |
| Kontak profil | Edit seluruh data | Edit telepon/alamat sendiri | Edit telepon/alamat sendiri |
| Presensi | Rekap organisasi + presensi sendiri | Rekap tim + presensi sendiri | Presensi dan histori sendiri |
| Pengajuan cuti | Pantau semua | Putuskan milik anggota tim, bukan diri sendiri | Ajukan dan lihat status sendiri |
| Payroll | Siapkan dan terbitkan periode | Tidak memiliki akses payroll | Slip sendiri setelah terbit |
| Penilaian | Baca hasil organisasi | Nilai anggota tim aktif, bukan diri sendiri | Baca hasil sendiri |
| Master data/akun | Kelola | Tidak tersedia | Tidak tersedia |

Permintaan API, ekspor, dan download dokumen wajib menerapkan matriks yang sama di backend. Manager menggunakan departemen akun sebagai ruang lingkup, tidak bergantung pada nama departemen yang ditulis tetap di kode. Hubungan atasan lintas departemen belum masuk demo dan memerlukan model supervisor terpisah jika dibutuhkan.

### 23.3 Aturan Data dan Validasi

1. Karyawan: nomor induk unik, email unik tanpa membedakan kapital, nama/jabatan/alamat bukan spasi kosong, telepon valid, tanggal bergabung terisi, gaji pokok tidak negatif. Identitas tiga akun demo tetap aktif agar skenario pengujian dapat diakses.
2. Presensi: satu pasangan masuk/keluar per karyawan per tanggal Jakarta; keluar hanya setelah masuk dan tidak boleh diulang. Tanggal histori dapat dipilih. Hadir dihitung dari catatan masuk, bukan dari status karyawan aktif. Terlambat pada demo berarti masuk setelah 08.00 WIB. Hari libur, shift, toleransi, koreksi presensi, dan bukti izin perlu dikonfigurasi di tahap lanjutan.
3. Cuti: tanggal tidak lampau, selesai tidak sebelum mulai, minimal satu hari kerja, tidak bentrok dengan pengajuan menunggu/disetujui. Demo tidak menghitung akhir pekan dan belum mengetahui hari libur nasional. Pengajuan lintas tahun dipisah. Cuti tahunan menunggu ikut mereservasi kuota; ditolak melepaskan reservasi. Kuota dihitung per karyawan per tahun.
4. Persetujuan: hanya manager tim, hanya status menunggu, tidak boleh memutuskan pengajuan sendiri. Catat nama pemutus, tanggal keputusan dan alasan wajib pada penolakan. Untuk produksi gunakan ID user dan waktu server yang tidak dapat dimanipulasi.
5. Payroll: periode memiliki status draft/diterbitkan. Semua komponen harus bilangan nonnegatif, potongan tidak melebihi gaji + tunjangan + bonus. Saat terbit, gaji pokok disalin menjadi snapshot periode agar perubahan gaji berikutnya tidak mengubah slip lama. Komponen dikunci setelah terbit; pembatalan/revisi resmi membutuhkan alur audit backend.
6. Kinerja: nilai 0–100 dan catatan wajib, disimpan per karyawan/periode dengan tanggal dan penilai. Periode yang belum dinilai menampilkan keadaan kosong, bukan hasil periode lain. Manager tidak menilai dirinya sendiri.
7. Master: nama tidak kosong/duplikat, penggantian nama memperbarui referensi karyawan. Produksi harus memakai ID master/foreign key; penghapusan master yang sudah digunakan perlu ditolak atau diarahkan ke pengarsipan.
8. Ekspor: CSV meng-escape kutipan/pemisah dan menetralisasi awalan formula spreadsheet. Ekspor karyawan mengikuti pencarian/filter. Rekap presensi mengikuti tanggal, payroll/kinerja mengikuti periode dan peran.

### 23.4 Tambahan Kebutuhan Fungsional

| ID | Kebutuhan tambahan | Tahap |
|---|---|---|
| FR37 | Profil sesuai identitas aktif dan perubahan kontak sendiri | Frontend |
| FR38 | Histori presensi menurut tanggal dan indikator dari catatan presensi | Frontend |
| FR39 | Validasi bentrok, hari kerja, reservasi dan kuota tahunan cuti | Frontend demo; backend wajib mengulang |
| FR40 | Alasan penolakan dan metadata keputusan cuti | Frontend; waktu/identitas server berikutnya |
| FR41 | Payroll per periode, snapshot dan penguncian setelah terbit | Frontend demo; transaksi backend berikutnya |
| FR42 | Penilaian per periode tanpa penilaian diri sendiri | Frontend |
| FR43 | Edit master konsisten, simulasi status/peran akun | Frontend; undangan akun sebenarnya berikutnya |
| FR44 | CSV sesuai filter dan aman dari formula | Frontend |
| FR45 | Tes otomatis dan pipeline pemeriksaan setiap push/PR | CI |

## 24. Kriteria Penerimaan dan Pengujian

### 24.1 Kriteria UI/UX

- Halaman berbahasa Indonesia dengan label input, tombol, status, keadaan kosong dan pesan kesalahan yang jelas.
- Layout tidak meluber pada lebar desktop dan ponsel sekitar 390 px; tabel panjang dapat digulir secara horizontal di area tabel.
- Navigasi ponsel menutup setelah modul dipilih. Modal panjang dapat digulir dan tombol simpan tetap dapat dijangkau.
- Navigasi keyboard, fokus modal, urutan tab dan kontras harus diuji sebelum produksi. Audit WCAG menyeluruh belum dinyatakan lulus hanya berdasarkan tes otomatis dasar.
- Semua data harus berlabel demo. Keadaan loading/gagal API, retry, pagination server dan konflik perubahan akan ditambahkan ketika API tersedia; daftar kecil di memori belum memerlukan simulasi jaringan.

### 24.2 Kriteria Data/Alur

- Profil Admin HR tidak menampilkan profil Karyawan.
- Manager tidak melihat anggota departemen lain dan tidak memiliki aksi penilaian diri sendiri.
- Check-in/check-out tercatat untuk akun/tanggal yang benar; status selesai mencegah klik berulang.
- Pengajuan tanggal bentrok, kuota habis, lintas tahun, tanggal tidak valid dan akhir pekan saja ditolak.
- Slip karyawan tidak muncul sebelum payroll diterbitkan; periode lain tetap draft; perubahan gaji tidak mengubah nominal pokok snapshot lama.
- Nilai kinerja periode baru tidak diwarisi otomatis dari periode sebelumnya.
- Laporan CSV dapat diunduh, dengan nama file yang jelas dan data sesuai lingkup akses.
- Pengujian frontend tidak membuktikan autentikasi aman, integritas database, kepatuhan penggajian atau ketahanan concurrency.

### 24.3 Strategi Tes

Unit test (Vitest) memeriksa tanggal Jakarta, hari kerja, kuota/reservasi, bentrok cuti, escaping CSV dan validasi komponen payroll. Browser test (Playwright Chromium) menjalankan alur profil, lingkup tim, presensi, histori, download CSV dan penerbitan slip pada desktop serta ponsel. Lint tanpa warning, TypeScript dan build produksi menjadi quality gate. Tambahkan tes API/RLS, transaksi, konkurensi, audit log, backup dan pemulihan ketika backend dibangun.

## 25. Git, CI/CD, dan Deployment

Repository: https://github.com/Jonatanarya/capstone_hris. Source frontend berada di root repository; dokumen ini juga disalin ke folder `docs` agar perubahan kebutuhan ikut terlacak.

1. Push ke `main` atau pull request memicu workflow **Frontend CI**: instalasi dari lockfile, lint, pemeriksaan tipe, unit test, build, lalu browser test.
2. Workflow **Deploy Vercel** berjalan hanya untuk commit `main` dari repository yang sama setelah CI sukses dan variable `ENABLE_VERCEL_DEPLOY=true`.
3. Konfigurasi membutuhkan repository/environment secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Jangan menaruh token di source, README, chat atau file publik. Konfigurasikan melalui pengaturan GitHub.
4. CD mengambil SHA yang sudah lolos CI, menarik konfigurasi Vercel, membangun output Vercel dan deploy `--prebuilt --prod`. Deploy otomatis bawaan Git Vercel dinonaktifkan pada konfigurasi proyek agar tidak melewati gerbang tes.
5. Sebelum kredensial dan project Vercel tersedia, CI dapat berjalan tetapi deployment akan dilewati; ini bukan deployment berhasil. Verifikasi URL dan smoke test setelah aktivasi.
6. Gunakan pull request untuk perubahan berikutnya dan aktifkan proteksi `main` setelah check CI tersedia. Rollback aplikasi melalui deployment Vercel sebelumnya; perubahan database kelak memerlukan migrasi/rollback tersendiri.

Vercel merupakan pilihan awal sesuai Bagian 18. GitHub Pages dapat menjadi opsi demo statis dengan `output: export`, tetapi bukan tempat menjalankan server/API Next.js. Pilihan provider akhir mengikuti keputusan kelompok.

## 26. Pekerjaan yang Tetap Belum Selesai

Prioritas berikutnya: autentikasi nyata, penyimpanan persisten, RLS/otorisasi server, model akun dan supervisor, audit log, integrasi notifikasi, kalender libur/kebijakan cuti, transaksi payroll, koreksi presensi, tes keamanan dan backup. Tidak memasukkan rekrutmen, GPS, fingerprint, perpajakan kompleks atau transfer bank otomatis ke lingkup frontend ini. Perancangan UML dan laporan akademik perlu diselaraskan dengan penambahan FR37–FR45 sebelum laporan akhir diserahkan; diagram yang ada belum otomatis berubah hanya karena dokumen ini diperbarui.
