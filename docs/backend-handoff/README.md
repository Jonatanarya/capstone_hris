# Handoff backend PeopleSpace HRIS

Versi usulan: **1.0 — 4 Oktober 2026**. Untuk Kelompok Capstone Project HRIS, kelas 4E.

**Mulai membaca dari file ini.** Paket ini adalah spesifikasi kerja bersama, bukan backend yang sudah berjalan. Belum ada migration, fungsi database, endpoint, RLS, atau koneksi Supabase yang dibuat oleh paket ini. Frontend tetap memakai data fiktif di memori.

## 1. Acuan dan urutan baca

| Urutan | Dokumen                                                | Digunakan untuk                                                    |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------ |
| 1      | [Kontrak API](01_API_CONTRACT.md)                      | Request/response, format data, operasi, error dan mapping frontend |
| 2      | [Rancangan database](02_DATABASE_DESIGN.md)            | Tabel, relasi, constraint, privasi dan transaksi                   |
| 3      | [Akses dan RLS](03_ACCESS_AND_RLS.md)                  | Hak akses, grants, fungsi aman dan larangan akses                  |
| 4      | [Backlog dan integrasi](04_BACKLOG_AND_INTEGRATION.md) | Pembagian tugas, milestone dan urutan pengerjaan                   |
| 5      | [Tes dan penyerahan](05_TEST_AND_DELIVERY.md)          | Skenario uji, checklist penerimaan dan kebutuhan staging           |

Acuan cakupan: [PRD/perencanaan](../Perencanaan_HRIS_Final_v2.md), khususnya Bagian 7–11 dan 23–26; [audit frontend](../AUDIT_FRONTEND.md). Paket ini memperjelas implementasi dan privasi. Jika ada perbedaan, sepakati revisi kontrak sebelum implementasi; jangan menganggap usulan ini sudah disetujui teman backend.

## 2. Arsitektur kerja yang diusulkan

**Browser Next.js → API aplikasi `/api/v1` → Supabase Auth/PostgreSQL dengan identitas pengguna + RLS/RPC.**

API aplikasi adalah Route Handlers di proyek Next.js yang sekarang, **bukan endpoint bawaan Supabase dan belum tersedia**. Lapisan ini mengubah format DB menjadi DTO frontend, menjaga session, membatasi field dan menyamakan error. Tidak perlu membuat Express terpisah untuk rancangan awal ini.

- PIC frontend: tampilan, adapter data, penanganan loading/error, integrasi session UI; mengerjakan Route Handlers penghubung berdasarkan kontrak bersama.
- PIC backend: schema/migration, RLS/grants, Supabase Auth, RPC/transaksi bisnis, fixture dan tes database; mendampingi verifikasi Route Handlers dan operasi akun privileged.
- Keduanya: menyetujui kontrak, melakukan review, mengetes satu alur lengkap dan menjaga environment staging.

Operasi bisnis kritis memakai fungsi PostgreSQL/RPC agar pemeriksaan dan perubahan terjadi dalam satu transaksi. Next.js tidak boleh melakukan beberapa request DB terpisah lalu menganggapnya transaksi atomik. Jika tim memilih akses SDK langsung untuk sebagian pembacaan, dokumentasikan perubahan transport dan tetap pertahankan DTO, hak akses dan aturan dalam paket ini.

## 3. Keputusan awal yang perlu dikonfirmasi bersama

| Topik               | Usulan awal                                                     | Status                                             |
| ------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| Backend             | Supabase Auth + PostgreSQL + RLS                                | Sesuai PRD; teman backend perlu konfirmasi         |
| Lingkup organisasi  | Satu organisasi, bukan SaaS multi-tenant                        | Sesuai lingkup capstone                            |
| Tim Manager         | Departemen karyawan yang terhubung ke akun Manager saat operasi | Mengikuti demo; atasan lintas departemen belum ada |
| ID                  | UUID; nomor induk sebagai identitas bisnis terpisah             | Mengganti ID angka/Date.now demo                   |
| Periode             | `YYYY-MM`                                                       | Mengganti label bulan Indonesia pada payload       |
| Uang                | Rupiah bulat, angka JSON aman, tanpa float                      | Dibatasi kontrak API                               |
| Waktu               | Timestamp UTC; tanggal kerja/aturan hari menurut Asia/Jakarta   | Waktu dicatat server                               |
| Cuti                | 12 hari/tahun, Senin–Jumat, pending ikut memesan kuota          | Asumsi demo, bukan ketentuan hukum                 |
| Gaji/kontak pribadi | Dipisah dari direktori karyawan                                 | Pengetatan privasi untuk implementasi nyata        |
| Login               | Akun internal/undangan, bukan signup publik bebas               | Usulan keamanan MVP                                |
| Payroll Manager     | Tidak tersedia, termasuk akses sebagai Manager ke slip sendiri  | Mengikuti PRD/demo; perubahan perlu persetujuan    |

Tidak perlu menambah rekrutmen, BPJS/pajak kompleks, GPS, fingerprint atau transfer bank otomatis. Kalender libur, shift, koreksi presensi dan perhitungan cuti pro-rata perlu keputusan kebijakan tersendiri.

## 4. Target integrasi pertama

**Login nyata → `/me` → daftar karyawan yang sesuai peran → refresh tetap login dan data tetap tersimpan.**

Selesai pertama bukan berarti semua modul langsung dipindah ke Supabase. Integrasikan modul per modul; modul yang masih mock harus tetap jelas berlabel demo. Hindari mode campuran yang menulis pengajuan nyata tetapi memakai kuota atau role dari mock.

## 5. Yang perlu teman backend serahkan dahulu

1. Konfirmasi pendekatan di atas dan PIC setiap tugas (isi nama anggota setelah disepakati).
2. Migration tabel dasar + grants/RLS yang dapat diterapkan ulang dari repository.
3. Akun staging fiktif Admin HR, Manager Engineering, Karyawan Engineering, Karyawan luar tim dan akun nonaktif. Password dikirim lewat kanal privat, tidak di repo.
4. URL project staging dan konfigurasi publishable key melalui pengaturan environment; secret/admin key hanya melalui penyimpanan rahasia server.
5. Konfirmasi struktur hasil `/me`, direktori karyawan dan error akses beserta tes allow/deny.

Tidak memerlukan token Supabase asli untuk membaca atau menyetujui paket ini. Jangan menaruh password, database connection string, secret key atau data HR nyata di dokumen/repository publik.

## 6. Cara mengubah kontrak

Gunakan PR yang mencantumkan field/operasi yang berubah, alasan, contoh payload lama/baru, efek terhadap frontend, migration dan tes. Perubahan wajib pada field, role, status, ID atau format error dianggap perubahan kontrak; sepakati sebelum merge. Dokumen v1 ini perlu disahkan kedua PIC sebelum dianggap baseline integrasi.

## Referensi resmi

- [Supabase + Next.js SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [RLS dan grants](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
