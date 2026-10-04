# 05 — Tes, staging dan checklist penyerahan

Status: **rencana pengujian backend/integrasi, bukan hasil tes yang sudah lulus**. Frontend CI sekarang memeriksa demo, bukan keamanan Supabase. Backend perlu menyerahkan bukti allow/deny, constraint dan transaksi di lingkungan uji.

## 1. Fixture yang harus disediakan backend

| Alias   | Identitas bisnis fiktif | Role/status                   | Dipakai untuk                               |
| ------- | ----------------------- | ----------------------------- | ------------------------------------------- |
| HR      | Nadia, Human Resources  | ADMIN_HR ACTIVE               | Administrasi penuh dalam scope HR           |
| M-ENG   | Dimas, Engineering      | MANAGER ACTIVE                | Read/approval/review tim, self-operation    |
| E-ENG   | Rizky, Engineering      | EMPLOYEE ACTIVE               | Own profile/presensi/cuti/slip/review       |
| E-OTHER | Citra, Marketing        | EMPLOYEE ACTIVE               | Percobaan akses orang lain/luar tim         |
| E-OFF   | Bima, Engineering       | EMPLOYEE; employment INACTIVE | Token valid tidak dapat akses data aplikasi |
| A-OFF   | Akun penguji tambahan   | account DISABLED              | Block akses dengan session lama             |
| A-INV   | Akun undangan penguji   | account INVITED               | Belum akses data sebelum aktivasi           |
| ANON    | Tanpa session           | anon                          | Semua data HR ditolak                       |

Nama/email di repository tidak harus dijadikan akun email deliverable. Local testing memakai alamat fiktif; untuk undangan staging gunakan inbox penguji yang dikontrol tim dengan identitas karyawan fiktif. Kirim password test melalui kanal privat. UUID, Auth user IDs dan koneksi fixture harus benar-benar terhubung; ID contoh kontrak bukan akun yang sudah ada.

Untuk invariant last-HR, tambahkan HR kedua sementara di lingkungan uji agar demotion/disable akun HR lain dapat diuji tanpa kehilangan akses project. Jangan menguji dengan akun pemilik production.

## 2. Skenario penerimaan

| ID       | Skenario                                                                     | Hasil yang harus dibuktikan                                                         |
| -------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AUTH-01  | Login valid, refresh, logout                                                 | Session nyata; refresh tetap login, logout membersihkan session UI                  |
| AUTH-02  | Email/password salah                                                         | 401 INVALID_CREDENTIALS generik, tidak bocorkan keberadaan email                    |
| AUTH-03  | Body login mempunyai role=ADMIN_HR                                           | Field ditolak, tidak menaikkan privilege                                            |
| AUTH-04  | Cookie/token palsu/kedaluwarsa                                               | Identitas diverifikasi/refresh sesuai flow; invalid 401                             |
| AUTH-05  | Account DISABLED/employee INACTIVE dengan token lama                         | Akses data ditolak, bukan tergantung hilangnya cookie                               |
| AUTH-06  | Signup bebas atau invite activation dipalsukan                               | Tidak ada profile/role aktif dari input client; INVITED belum akses data            |
| AUTH-07  | Request mutation lintas origin/tanpa CSRF valid                              | Ditolak; callback flow valid tetap bekerja                                          |
| EMP-01   | HR membuat karyawan lengkap                                                  | Employee/contact/compensation konsisten dan tersimpan setelah refresh               |
| EMP-02   | Duplikasi employeeNo/email/name master dengan kapital berbeda                | 409 sesuai kontrak; tidak ada record setengah jadi                                  |
| EMP-03   | Manager list/detail tim vs luar tim                                          | Tim summary terlihat, luar tim tidak; gaji/alamat/telepon orang lain tidak tersedia |
| EMP-04   | Employee GET/PATCH ID orang lain                                             | Deny/404 dalam scoped detail; kontak hanya own; tidak mutasi record lain            |
| EMP-05   | Self-contact edit bersamaan dengan HR edit versi lama                        | Version conflict, tidak silent overwrite                                            |
| EMP-06   | Rename master                                                                | FK tetap, label UI baru; scope Manager tidak rusak                                  |
| EMP-07   | Manipulasi employeeId/role/compensation di own contact                       | Field terlarang ditolak; role/gaji tetap                                            |
| ATT-01   | Masuk/keluar normal, histori dan WIB                                         | Timestamp server, work_date Jakarta, refresh tetap ada                              |
| ATT-02   | Dua check-in bersamaan                                                       | Tepat satu record; lainnya 409 ALREADY_CHECKED_IN                                   |
| ATT-03   | Keluar sebelum masuk / keluar dua kali                                       | 409 CHECK_IN_REQUIRED/ALREADY_CHECKED_OUT, tidak ubah catatan                       |
| ATT-04   | Browser mengirim employeeId/tanggal/jam palsu                                | 422 field terlarang; record tetap menggunakan identitas dan waktu server            |
| ATT-05   | Pergantian tanggal UTC vs Jakarta, histori luar scope                        | Tanggal sesuai WIB, scope sama dengan direktori                                     |
| LEAVE-01 | Pengajuan normal, pending lalu keputusan                                     | PENDING memesan kuota; approver/waktu server tercatat                               |
| LEAVE-02 | Invalid date, reversed, tahun berbeda, weekend saja, alasan kosong           | 422; tidak membuat request atau reservasi                                           |
| LEAVE-03 | Overlap pending/approved termasuk jenis lain                                 | 409 LEAVE_OVERLAP, tidak mengurangi kuota                                           |
| LEAVE-04 | Dua pengajuan bersamaan yang totalnya melampaui kuota                        | Tidak oversubscribe; satu/bagian yang tak memenuhi ditolak atomik                   |
| LEAVE-05 | Reject tanpa alasan, self/outside-team approval                              | Deny/422 sesuai input; status tetap PENDING                                         |
| LEAVE-06 | Approve/reject bersamaan pada request sama                                   | Satu keputusan; yang lain 409, audit/kuota konsisten                                |
| LEAVE-07 | Rejected dan pengajuan tahun lain                                            | Kuota tahun yang diminta tidak salah berkurang                                      |
| PAY-01   | Draft/edit/publish normal                                                    | Rumus server benar, seluruh item satu transaksi                                     |
| PAY-02   | Nominal negatif/float/NaN/potongan > bruto/net dari client                   | 422, published tidak berubah; JSON nonvalid 400                                     |
| PAY-03   | Employee baca/download draft atau slip orang lain; Manager payroll           | Deny; own published saja untuk Employee, Manager tidak mengakses payroll            |
| PAY-04   | Gaji/nama/master berubah setelah publish                                     | Slip lama tetap snapshot, bukan data profil baru                                    |
| PAY-05   | Dua publish atau edit item bersamaan publish                                 | Status/versi konsisten; tidak setengah terbit atau teredit setelah publish          |
| PAY-06   | Satu item invalid/kompensasi hilang saat publish                             | Seluruh publish rollback, tidak menyisakan item published                           |
| PERF-01  | Nilai 0/100 dan catatan, ganti periode                                       | Benar per periode; kosong tidak mewarisi hasil lama                                 |
| PERF-02  | Nilai di luar rentang, HR menulis, self/outside-team review                  | Ditolak, hasil sebelumnya tetap                                                     |
| PERF-03  | Dua update versi sama / create periode sama                                  | UNIQUE/version ditegakkan; tidak ada duplicate/silent overwrite                     |
| ACCT-01  | Invite ulang key/payload sama dan provisioning gagal                         | Tidak membuat akun ganda; kegagalan aman/retry terkontrol                           |
| ACCT-02  | Employee/Manager menaikkan role melalui API/RPC/Data API                     | Selalu deny, role DB tetap                                                          |
| ACCT-03  | HR self-disable/demote atau disable HR aktif terakhir lewat employee/account | Ditolak dari semua jalur, invariant tetap                                           |
| DATA-01  | Filter/employeeId/page detail/dashboard/CSV luar scope                       | Tidak meluaskan scope; total/agregasi tidak membocorkan data lain                   |
| DATA-02  | CSV kutipan, newline, =/+/-/@ dan >10.000 baris                              | Escape/formula guard, ekspor berlebih ditolak bukan dipotong diam-diam              |
| SEC-01   | Akses Supabase REST langsung ke tabel private/draft/role                     | Grants/RLS menolak meskipun UI/Next handler dilewati                                |
| SEC-02   | Panggil RPC elevated sebagai anon/nonaktif/role salah/pemilik palsu          | Fungsi sendiri memverifikasi actor dan scope; tidak side effect                     |
| SEC-03   | Error DB/log/network/bundle/frontend env                                     | Tidak ada secret, token, SQL detail atau data privat terlarang                      |
| SEC-04   | Cache session/data antara dua akun                                           | Tidak ada session/dokumen pengguna A diterima pengguna B                            |
| SEC-05   | Audit insert/update/delete dipalsukan client                                 | Ditolak; hanya operasi tepercaya mencatat audit                                     |

Tes harus mencakup constraint tingkat DB dan RPC, bukan hanya klik UI. Contoh RLS yang menghasilkan array kosong tidak membuktikan write sudah diblokir; uji setiap operasi dan field yang terlarang.

## 3. Checklist kualitas UI setelah data nyata

- [ ] Loading, empty, offline/503, 401 session expired, 403 denied dan 409 conflict dapat dibedakan.
- [ ] Tidak ada fallback seed yang menyamarkan error API sebagai data nyata.
- [ ] UUID/periode enum ditampilkan dengan label Indonesia yang benar; WIB hanya format tampilan, bukan modifikasi timestamp sumber.
- [ ] Form disable saat pending; retry mutation tidak menggandakan transaksi. Jika respons tak pasti, refetch sebelum mengulang.
- [ ] Setelah save/publish/decision, refetch data dan ringkasan/balance yang berubah.
- [ ] Frontend tidak memutuskan role/kuota/status published sendiri; state mengikuti respons server.
- [ ] Ponsel/keyboard/modal panjang dan tabel pagination dapat dipakai; audit aksesibilitas lengkap tetap perlu pemeriksaan tersendiri.
- [ ] Slip/cetak/CSV memakai nama dan snapshot yang benar tanpa field privat ekstra.

## 4. Konfigurasi lingkungan (nama, bukan nilai rahasia)

| Nama usulan                                      | Tempat/penggunaan                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL                         | URL local/staging/production terpisah                                           |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY             | Client user/server SSR; bukan admin key atau identitas pengguna                 |
| SUPABASE_SECRET_KEY                              | Server admin terisolasi untuk operasi Auth administratif; hanya bila diperlukan |
| VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID | Secret deployment GitHub yang sudah dirancang, bukan secret browser             |
| ENABLE_VERCEL_DEPLOY                             | Variable repository untuk mengaktifkan CD setelah project/secrets siap          |

Nama dua variable publishable mengikuti panduan Supabase agar kompatibel integrasi SDK jika diperlukan. Arsitektur MVP tetap server-only auth; prefix NEXT_PUBLIC bukan alasan memberi secret elevated. Jika memakai project lama dengan anon/service_role, dokumentasikan mapping dan jangan menukar key user dengan key admin.

Simpan nilai melalui environment lokal yang di-ignore dan secret store provider. Paket ini tidak membuat .env, project Supabase, token, undangan akun atau deployment. Supabase Auth Site URL/redirect allowlist harus meliputi callback/recovery origin yang disetujui; jangan wildcard domain sembarang.

Gunakan project staging terpisah dengan data fiktif; seluruh PIC harus tahu project reference sebelum menjalankan migration. Production tidak menjadi sandbox untuk tes atau reset. [Panduan key resmi](https://supabase.com/docs/guides/getting-started/api-keys).

## 5. Apa yang diserahkan backend pada setiap milestone

- [ ] Migration + grants/RLS + RPC + perubahan kontrak dalam PR yang dapat direview.
- [ ] Cara setup lokal/staging yang reproducible, daftar extension dan urutan migration.
- [ ] Fixture tidak sensitif; kredensial Auth diberikan privat, bukan ditulis di README.
- [ ] Hasil tes berisi environment, SHA, kasus pass/fail dan keterbatasan (bukan screenshot sukses satu kasus saja).
- [ ] Contoh respons sukses/error untuk frontend dan mapping code error.
- [ ] Catatan perubahan data/migration, risiko deploy dan rollback. Backup/pemulihan remote diverifikasi sebelum data penting dipakai.
- [ ] Tidak mengklaim migration/RLS selesai jika belum dapat diterapkan pada DB uji baru.

## 6. CI/CD

Saat ini **Frontend CI** menjalankan audit production dependencies, lint, typecheck, unit test demo, build dan tes browser demo. **Deploy Vercel** masih bergantung project/secret dan variable aktivasi. Paket dokumentasi ini tidak menambah job Supabase atau melakukan deployment.

Setelah backend ada, tambahkan job integration/database: boot Supabase lokal/test stack, apply migration pada database disposable, seed Auth secara aman, jalankan pgTAP/RLS/RPC/API tests, lalu browser test dengan tiga role nyata. Tetapkan secrets/isolasi runner dan kapan integration test boleh berjalan; PR dari fork tidak boleh memperoleh secret remote privileged.

Workflow lokal/test jangan mereset DB staging/production. Deploy migration harus job terkontrol dengan project/environment jelas dan persetujuan yang diperlukan, bukan db push asal di setiap PR. Uji preview aplikasi terhadap staging dahulu; produksi setelah kedua PIC menyetujui hasil penerimaan. Rujukan: [Supabase migrations](https://supabase.com/docs/guides/local-development/database-migrations), [RLS testing](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 7. Pertanyaan kebijakan yang belum diputuskan

1. Kalender libur nasional/organisasi dihitung dari tahap pertama atau setelah MVP?
2. Apakah semua role nantinya boleh mengajukan cuti dan melihat slip sendiri, atau tetap mengikuti hak PRD saat ini?
3. Bagaimana pengajuan cuti yang melewati akhir tahun, karyawan baru/pro-rata, pembatalan dan kuota carry-over? V1 membatasi lintas tahun dan belum menyediakan cancel/carry-over.
4. Apakah presensi pada hari libur atau saat cuti approved diizinkan? Demo belum punya kebijakan ini; harus disepakati sebelum aturan produksi dibuat.
5. Bagaimana shift lintas hari/koreksi presensi dan supervisor lintas departemen? Di luar v1.
6. Apa kebijakan retensi data/audit dan perubahan email karyawan yang sudah terhubung ke Auth?

Jawaban dicatat sebagai revisi kebijakan/kontrak, bukan hardcode diam-diam pada satu sisi. Tidak ada paket dokumentasi yang dapat menggantikan pengujian backend nyata.
