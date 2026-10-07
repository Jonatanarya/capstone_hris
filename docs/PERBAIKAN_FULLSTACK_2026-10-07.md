# Perbaikan full-stack PeopleSpace — 7 Oktober 2026

Dokumen ini menindaklanjuti [audit awal](AUDIT_FULLSTACK_2026-10-07.md). Audit awal tetap disimpan sebagai bukti kondisi sebelum perbaikan, bukan status aplikasi setelah perubahan ini.

## Perubahan

- Kompensasi private dibaca melalui RPC khusus HR memakai identitas pengguna. Kesalahan baca tidak diubah menjadi gaji nol. Form edit/detail memuat kontak, gaji, dan versi terkini terlebih dahulu; kegagalan menutup akses form. Snapshot payroll tidak digunakan sebagai kompensasi terkini.
- Penulisan tabel bisnis dan master langsung ditutup, termasuk TRUNCATE/DELETE. RPC master juga mencatat audit dan memeriksa versi. Private schema tidak dijadikan public.
- Manager tidak dapat membaca payroll melalui Data API atau membuat pengajuan khusus Employee. Akun inactive/DISABLED/INVITED tidak bisa membaca saldo cuti. Kontak sendiri berubah melalui RPC yang menaikkan versi aggregate employee.
- Pengajuan cuti dan keputusan memakai urutan lock employee → request. Pemeriksaan overlap/kuota dilakukan setelah lock. Presensi juga diserialisasi per employee. Review dibuat/diubah setelah lock employee, menolak target inactive dan versi stale.
- Perubahan akun/karyawan HR diserialisasi. Penonaktifan employee HR sendiri ditolak; perhitungan HR aktif memasukkan status employment, bukan hanya account status.
- Payroll dikunci parent terlebih dahulu. Saat publication, kompensasi terbaru disalin ke item dan net dihitung ulang; deduction yang melampaui gross terbaru membatalkan seluruh publication. Payroll published tetap immutable.
- Halaman akun memakai daftar akun asli beserta role/status/version, bukan setiap employee dianggap mempunyai akun. Identitas sendiri terkunci di UI dan database. Undangan baru untuk employee aktif tanpa akun membutuhkan tindakan pengguna.
- Invitation bookkeeping memakai private RPC claim/record/finalize. Kunci yang sama tidak mengirim ulang email. Jika hasil Auth tidak pasti, operasi ditahan untuk rekonsiliasi, bukan menghapus akun atau mengirim undangan kedua secara otomatis.
- Recovery page tersedia. Callback mendukung token_hash invite/recovery dan PKCE code, tanpa open redirect. Perubahan password melalui kedua endpoint `/auth/password` dan `/auth/recover` wajib menggunakan flow bertanda tangan, berumur 15 menit, dan cocok dengan identitas sesi. Aktivasi INVITED dilakukan server setelah penyimpanan password, dengan employee masih aktif.
- Mutasi browser wajib exact same-origin + header non-simple `X-HRIS-Request: 1`; tidak ada CORS cross-origin yang membolehkan header tersebut. JSON harus objek, memiliki content-type benar, dan dibatasi 32 KiB. Cookie session server-only memakai HttpOnly; Secure pada deployment Vercel; response private no-store. Logout hanya sesi lokal dan membersihkan state UI.
- Header anti-framing, nosniff, referrer policy, permissions policy, dan CSP dasar ditambahkan. CSP masih mengizinkan inline bootstrap Next; ini **bukan** klaim strict nonce CSP.
- Dashboard dan saldo cuti mengambil hasil API. Live tidak memakai seed employee/presensi/cuti/review. Periode live dinamis, master yang belum dipakai tetap terlihat. Grafik mingguan masih berlabel ilustrasi, bukan analytics historis.
- UI mengambil seluruh halaman daftar sampai batas 10.000. Ekspor CSV memakai filter employee dan query payroll per periode, mengambil batch dengan count, serta gagal eksplisit bila melebihi batas. Download baru dianggap sukses setelah respons berhasil.
- Migration baru `0007`/`0008` additive; migration lama tidak di-replay. Runner menolak pemilihan file kosong, transaksi atomik per file, berhenti jika gagal, dan merekam checksum yang dinormalisasi newline pada `private.app_migrations`. Ledger ini **bukan** ledger Supabase CLI; jangan memakai kedua mekanisme pada project yang sama tanpa rekonsiliasi.
- Sandi default dihapus dari script/dokumentasi dan tidak dicetak oleh seed. Provisioning seed remote membutuhkan konfirmasi project eksplisit; tidak dilakukan selama perbaikan.

Template email mengikuti [dokumentasi resmi Supabase](https://supabase.com/docs/guides/auth/auth-email-templates): tautan token_hash diproses aplikasi sebelum membuat sesi server. Script konfigurasi mempertahankan isi template lama dan hanya mengganti tautan konfirmasi. SMTP dan kredensial tidak dicetak atau diubah.

## Verifikasi lokal

| Pemeriksaan                  | Hasil / cakupan                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Unit/API mock                | 63/63 lulus, termasuk idempotensi dan provisioning gagal sebagian; tidak mengirim email                |
| Database rollback            | 39/39 assertion lulus pada project terkonfigurasi dengan migration pending di dalam transaksi rollback |
| Desktop + mobile demo        | 12/12 lulus                                                                                            |
| Desktop + mobile live        | 8/8 lulus; API data dimock, sedangkan guard CSRF dan signed-flow menggunakan server nyata              |
| Lint seluruh app/lib/proxy   | Tanpa warning                                                                                          |
| TypeScript + build demo/live | Lulus                                                                                                  |
| Dependency production        | 0 vulnerability saat pengujian                                                                         |

CI sekarang menjalankan matrix demo/live dan job PostgreSQL terisolasi yang memasang migration dari awal lalu menguji 39 assertion. Auth pada job database adalah stand-in JWT/role, **bukan** layanan Auth/SMTP Supabase. CD tetap hanya deploy SHA main yang seluruh CI-nya sukses.

## Operasional dan batasan

1. **Wajib rotasi manual sandi fixture yang pernah dipublikasikan**, token Vercel yang pernah dibagikan, dan token/key lain bila ikut terekspos. Menghapus teks tidak menghapus riwayat Git maupun mengganti kredensial live. Tidak ada sandi/token yang dirotasi otomatis.
2. UAT undangan/reset melalui inbox sungguhan dan penetapan password belum dilakukan, agar tidak mengirim email atau mengubah identitas pengguna. Fixture `@example.test` tidak bisa membuktikan deliverability. Gunakan akun staging dan SMTP terkonfigurasi.
3. Provisioning yang terhenti memerlukan operator. Baca `private.operation_requests` sebagai operator, cocokkan `employee_id`, `actor_user_id`, email Auth, dan external ID. Bila Auth benar-benar ada dan identitas cocok, gunakan service-role RPC `record_invitation_external` lalu `finish_account_invitation`. Jangan memilih user Auth berdasarkan tebakan atau membuat idempotency key baru. Replay finish yang SUCCEEDED mengembalikan hasil lama tanpa insert kedua.
4. Database migration produksi memakai runner terkontrol, bukan otomatis memasukkan PAT akun ke GitHub. CI database tidak mengakses data produksi. Migration 0001–0006 merupakan baseline lama tanpa backfill ledger; setup kosong melalui CI berbeda dari update produksi.
5. Pengujian ini tidak menggantikan audit keamanan independen, load test, restore backup/PITR, aksesibilitas lengkap, atau UAT seluruh browser. Single organization; belum mendukung multi-tenant. Jangan memasukkan data HR sensitif sebelum rotasi dan UAT selesai.

## Perintah aman

```sh
npm run test:database -- --with-pending # sebelum 0007/0008 diterapkan; semua perubahan rollback
npm run db:apply -- 0007 --dry-run
npm run db:apply -- 0008 --dry-run
# Setelah validasi dan menjelang deployment kompatibel:
npm run db:apply -- 0007 0008
npm run test:database                # sesudah migration; rollback-only
node scripts/configure-auth.mjs --site-url https://peoplespace-hris.vercel.app
# Tambah --apply hanya untuk konfigurasi yang memang akan dipersist.
```

Auth hardening menutup self-signup, mengatur Site URL produksi dan allowlist callback invite/recovery, minimum password setidaknya 8 karakter, serta template token_hash. Tidak mengirim email, mengubah password, atau merotasi key.

Hasil deployment dan pengujian produksi setelah perubahan dicatat pada bagian berikut setelah workflow selesai.
