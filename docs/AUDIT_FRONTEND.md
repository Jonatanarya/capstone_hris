# Validasi frontend — 4 Oktober 2026

## Temuan dan perbaikan

| Temuan awal | Perbaikan |
|---|---|
| Starter menjalankan Vinext, walau perencanaan menyebut Next.js | dev/build/start sekarang Next.js resmi |
| Profil selalu Rizky walau berperan HR/Manager | Profil sesuai akun aktif, kontak dapat diedit |
| Data karyawan belum lengkap | Nomor induk, telepon, alamat, tanggal bergabung dan validasi unik |
| Jumlah hadir dihitung dari karyawan aktif | Hitung berdasarkan record presensi hari tersebut |
| Presensi satu variabel tanpa identitas/tanggal | Record per akun/tanggal WIB, filter histori dan status terlambat |
| Cuti memakai hari kalender, tidak cek bentrok/tahun/pending | Hari kerja, kuota per tahun, pending mereservasi kuota, cek konflik |
| Penolakan tanpa alasan/metadata | Alasan wajib, pemutus/tanggal keputusan; cegah approval sendiri |
| Payroll diproses sebagai satu boolean | Status tiap periode, snapshot gaji pokok dan kunci komponen terbit |
| Hasil kinerja terbawa antarperiode; manager menilai sendiri | Record per periode, keadaan belum dinilai, larangan self-review |
| Master hanya tambah; akun hanya daftar | Ubah nama/referensi; peran/status akun simulasi |
| CSV tidak menetralisasi formula dan mengabaikan filter karyawan | CSV escaping/formula guard; ekspor mengikuti filter |
| Tidak ada quality gate otomatis | Lint, typecheck, Vitest, Playwright desktop/ponsel, production build |
| Next.js 16.3.4 memiliki advisory dependensi kritis | Naik ke 16.3.8; scan dependensi production menjadi gate CI |
| Penomoran output dokumen salah | Subbagian 19.1–19.6; tambahan kebutuhan FR37–FR45 |

## Cakupan pengujian

Unit test: hari kerja/tanggal invalid, kuota pending/rejected/tahun lain, bentrok/akhir pekan/lintas tahun/tanggal lampau/kuota habis, zona waktu Jakarta, escaping CSV dan komponen payroll negatif/NaN/berlebih.

Browser test pada desktop dan ponsel: profil peran HR, batas tim Manager, self-review tidak tersedia, overflow halaman, check-in/out satu kali, histori tanggal, konfirmasi unduhan CSV, payroll draft vs terbit dan slip sendiri. Tes tidak membuktikan keamanan akses; semua state masih client-side.

Tes juga memeriksa tambah karyawan lengkap/nomor induk duplikat, rename departemen beserta referensi tim, pengajuan cuti/bentrok, alasan penolakan dan hasil penilaian yang terpisah antarperiode.

Advisory [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) menyebut Next.js 16.2.0 sampai sebelum 16.3.6. Proyek tidak menggunakan `next/og`/input SVG ImageResponse yang disebut dalam advisory, tetapi versi patch tetap diterapkan sebagai pencegahan. Scan paket bukan bukti aplikasi bebas seluruh kerentanan.

## Belum lengkap dan sengaja tidak diklaim selesai

Hasil pemeriksaan lokal setelah pembaruan: lint tanpa warning, TypeScript dan build produksi Next.js 16.3.8 lulus; 6 unit test dan 12 browser test lulus. `npm audit --omit=dev` melaporkan 0 advisory pada pemeriksaan 4 Oktober 2026. Hasil ini bukan audit keamanan menyeluruh. Status runner GitHub harus dilihat pada Actions untuk SHA commit terkait, dan deployment live tetap belum aktif.

- Auth nyata, authorization API/RLS, password/reset, undangan akun, akun nonaktif benar-benar tidak dapat login.
- Database/persistensi, audit log yang tidak dapat diubah, perubahan bersamaan, transaksi pengajuan/penerbitan.
- Kalender hari libur, kebijakan HR final, shift, koreksi presensi, supervisor lintas departemen.
- Pagination server, pencarian lintas data besar, state loading/error API, retry dan notifikasi nyata.
- Pemisahan komponen modul dari file UI utama yang masih besar; aturan bisnis sudah dipisahkan ke `lib/hris.ts`.
- Penilaian multiindikator/bobot, payroll BPJS/pajak/transfer bank (di luar lingkup awal).
- Audit aksesibilitas WCAG menyeluruh, cetak lintas browser, pengujian kinerja/security produksi.
- Penyelarasan ulang UML dan laporan akademik terhadap FR tambahan.
- CD live Vercel menunggu project/kredensial. CI sukses bukan bukti deployment berhasil.

Frontend tetap memakai data contoh di memori; refresh mereset simulasi. Ringkasan mingguan masih diberi label ilustrasi. Jangan memasukkan data HR asli ke demo atau repository publik.
