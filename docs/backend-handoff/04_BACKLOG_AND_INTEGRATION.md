# 04 — Pembagian kerja dan urutan integrasi

Status: **backlog yang disarankan, belum menjadi tugas yang sudah selesai**. PIC frontend/backend berarti peran kerja; isi nama anggota setelah tim menyepakati. Tidak ada pesan, undangan GitHub/Supabase atau assignment eksternal yang dikirim oleh paket ini.

## 1. Pembagian kepemilikan

| Area                                | PIC utama          | Reviewer/hasil yang diserahkan                                       |
| ----------------------------------- | ------------------ | -------------------------------------------------------------------- |
| UI, form, loading/error, responsive | Frontend           | Backend review kebutuhan data; tidak mengubah style tanpa koordinasi |
| DTO, adapter/service frontend       | Frontend           | Backend memvalidasi payload dengan kontrak                           |
| Route Handlers penghubung Next.js   | Frontend + backend | Review bersama session, field projection, scope dan CSRF             |
| Auth configuration/provisioning     | Backend            | Frontend mengintegrasikan UI session, callback/recovery              |
| Database/migration/master/fixture   | Backend            | Frontend review mapping ID/enum/periode                              |
| RLS/grants/helper dan RPC bisnis    | Backend            | Review + tes allow/deny/concurrency bersama                          |
| UI pengaturan akun privileged       | Frontend           | Backend mengontrol Auth admin client dan lifecycle akun              |
| Deployment/environments             | Bersama            | Secret hanya secret store; URL staging disepakati                    |
| UML/laporan akademik                | Bersama            | Diagram diselaraskan setelah kontrak disahkan                        |

Backend tidak perlu membangun server Express terpisah pada usulan ini. Frontend juga tidak perlu menulis logic transaksi payroll sebagai beberapa fetch yang terpisah.

## 2. M0 — Kontrak dan lingkungan (sebelum coding integrasi)

- [ ] Kedua PIC meninjau [API](01_API_CONTRACT.md), [database](02_DATABASE_DESIGN.md), [RLS](03_ACCESS_AND_RLS.md) dan menandai baseline v1 disetujui.
- [ ] Konfirmasi Supabase, single-organization, Manager scope departemen dan pembatasan gaji/kontak.
- [ ] Tetapkan policy demo sebagai konfigurasi: 12 hari, Mon–Fri, WIB, jam masuk; catat apakah libur nasional masuk tahap pertama.
- [ ] Sepakati batas password Auth, redirect callback/recovery, masa session dan mekanisme CSRF untuk API cookie.
- [ ] Backend menyediakan local/staging terpisah dari production, migration workflow dan fixture fiktif.
- [ ] Sepakati siapa mengedit Route Handlers; schema/RPC backend dan DTO frontend tidak berubah tanpa review PIC lain.

Keluar M0: tidak ada pertanyaan mendasar tentang field/role/transport; konfirmasi kebijakan dicatat, bukan diasumsikan dari contoh UI.

## 3. M1 — Login, profil, karyawan dan master (prioritas pertama)

| Backend                                                                        | Frontend                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Migration master/employees/contacts/compensation/profiles + grants/RLS minimum | Pecah data demo menjadi model direktori, profil privat dan kompensasi HR                    |
| Provision akun uji HR/Manager/dua Employee/inactive secara privat              | Hapus dropdown pemilihan role pada mode terintegrasi; role dari /me                         |
| Auth/session, status aktif dan helper identitas                                | Login/logout, error login generik, refresh session UI, route protection UX                  |
| RPC create/update employee dan own contact, normalisasi/unik/version           | Service employees/master/profile, UUID keys, filter/pagination, form memakai master ID      |
| Proyeksi read berbeda untuk HR, Manager dan pemilik                            | Jangan menampilkan alamat/telepon anggota tim Manager; jangan menyimpan gaji di Person umum |
| Penolakan role mutation/direktori luar scope                                   | Loading/empty/error, refetch setelah simpan, pesan konflik version                          |

Keluar M1: login nyata → profil → direktori sesuai peran → tambah/edit HR → refresh data tetap ada; account inactive dan direct Supabase bypass percobaan ditolak. PR hanya mengintegrasikan modul M1; modul lain tetap berlabel demo dan tidak memakai data nyata campur kuota mock.

## 4. M2 — Absensi

- [ ] Backend: tabel UNIQUE employee/date + RPC check_in/check_out + waktu server + histori scoped.
- [ ] Frontend: tombol dan waktu mengikuti respons server; format WIB; jangan mengirim jam dari perangkat sebagai fakta presensi.
- [ ] Frontend: missing record ditampilkan sebagai belum absen, bukan record sukses palsu.
- [ ] Bersama: tes klik/double request, check-out tanpa masuk, tanggal pergantian UTC/WIB dan akses tim.

Keluar M2: presensi yang sama tidak tercatat dua kali dan tersedia setelah refresh. Shift lintas hari/koreksi histori ditandai belum didukung.

## 5. M3 — Cuti dan keputusan Manager

- [ ] Backend: entitlement per tahun, request/status constraints, kuota/bentrok dengan lock, decision atomic + audit.
- [ ] Frontend: balance server; preview hari boleh lokal, hasil server tetap authoritative.
- [ ] Frontend: field error, 409 conflict, pending/approved/rejected, alasan penolakan, notifikasi hasil berbasis record nyata.
- [ ] Bersama: tes pengajuan berbarengan, akhir pekan, tahun berbeda, self-approval, departemen luar scope dan dua keputusan bersamaan.

Keluar M3: pending memesan kuota, penolakan melepas reservasi, keputusan hanya sekali, data/kuota tidak berubah setengah saat request gagal.

## 6. M4 — Penilaian kinerja

- [ ] Backend: UNIQUE employee/period, score range, current Manager scope, optimistic locking dan jejak assessor.
- [ ] Frontend: periode YYYY-MM; hasil kosong tidak memakai seed score; label nama/role dari DTO.
- [ ] Bersama: tes nilai batas 0/100, notes kosong, self-review, periode berbeda, perubahan departemen dan edit versi lama.

Keluar M4: Employee melihat hasil sendiri; HR membaca tetapi tidak menulis; Manager tidak dapat menilai dirinya atau luar tim.

## 7. M5 — Payroll, laporan dan administrasi akun

- [ ] Backend: run/items, draft component validation, snapshot publish semua item dalam transaksi, immutable published.
- [ ] Frontend: draft/terbit server, edit dikunci, own published slip, ekspor setelah terbit; hilangkan default nominal demo dari policy.
- [ ] Backend: proyeksi laporan/dashboard scoped, formula-safe CSV, pagination/filter dan batas ekspor.
- [ ] Backend: invite idempotency/provisioning bookkeeping, activation, role/status update dan last-active-HR invariant.
- [ ] Frontend: akun nyata dan status invitation/error/retry; jangan menganggap dropdown simulasi sebagai implementasi admin Auth.
- [ ] Bersama: tes edit gaji setelah publish, dua publish bersamaan, draft leak, role tampering, disable dengan session lama dan export scope.

Keluar M5: nominal server konsisten; tidak ada setengah terbit; undangan tidak meninggalkan akun berakses tanpa profil; fitur laporan hanya mengeluarkan data yang pemohon boleh lihat.

## 8. M6 — Staging dan penerimaan

- [ ] Backend menyerahkan migration/RLS/RPC, fixture, hasil tes dan catatan batas kebijakan.
- [ ] Frontend seluruh modul memakai sumber nyata staging, tanpa fallback seed yang menyamarkan kegagalan API.
- [ ] Uji alur lintas role di [checklist penerimaan](05_TEST_AND_DELIVERY.md), termasuk direct Data API dan secret exposure.
- [ ] CI backend ditambah setelah migration nyata tersedia; frontend CI yang ada tidak dianggap sudah menguji RLS.
- [ ] Deploy preview/staging sebelum production. Gunakan data fiktif; production hanya setelah persetujuan tim dan kredensial siap.
- [ ] Perbarui UML, ERD dan laporan akademik sesuai implementasi; packet ini tidak otomatis mengubah diagram.

## 9. Git dan aturan kerja bersama

Gunakan branch kecil, misalnya `feat/auth-profile`, `feat/backend-employees`, `feat/frontend-employees`, `feat/leave-rpc`. Contoh nama tidak berarti branch sudah dibuat. Setiap PR mencantumkan kontrak terkait, migration, bukti tes dan cara mencoba.

- Hindari kedua PIC mengedit bagian yang sama di file UI besar pada saat bersamaan; sepakati pembagian/service sebelum refactor.
- File migration baru, bukan mengubah migration yang sudah dipakai bersama. Tidak commit .env/password/token.
- Perubahan kontrak memerlukan review kedua PIC; tidak merge rename field diam-diam.
- CI harus lolos sebelum merge; aktifkan ruleset/branch protection secara sadar (belum diubah oleh paket ini).
- Jangan force push main atau reset data staging untuk menyelesaikan konflik kode.
- Deploy build commit yang diuji, bukan branch tidak jelas. Rollback aplikasi tidak berarti rollback migration/data aman.

## 10. Mapping ke kebutuhan PRD

| Milestone | Cakupan PRD utama                                          |
| --------- | ---------------------------------------------------------- |
| M1        | Karyawan/master/akun dasar, role, FR37 profil, FR43 master |
| M2        | Absensi dan histori, FR38                                  |
| M3        | Pengajuan/keputusan cuti, FR39–FR40                        |
| M4        | Penilaian, FR42                                            |
| M5        | Payroll, akun admin dan laporan, FR41/FR43/FR44            |
| M6        | NFR security/integrity/usability/maintainability, FR45 CI  |

Rekrutmen, payroll pajak/bank, shift lanjutan, aturan cuti legal final, supervisor lintas departemen dan notifikasi email bisnis bukan tambahan tersembunyi pada milestone ini.
