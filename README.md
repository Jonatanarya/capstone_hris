# PeopleSpace — HRIS Capstone 4E

Frontend HRIS berdasarkan `Perencanaan_HRIS_Final_v2.md`, dengan tampilan sederhana, terang, responsif, dan aksen biru.

## Menjalankan

Butuh Node.js 24 LTS (versi yang dipakai CI) dan npm.

```sh
npm ci
npm run dev
```

Buka http://localhost:5173. Untuk pemeriksaan:

```sh
npm run lint -- --max-warnings=0
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Tes browser menjalankan server produksi sendiri di port 5173. Matikan server dev di port itu sebelum tes. `npm run start` menjalankan build produksi secara manual.

## Fitur demo

- Dashboard: ringkasan karyawan, kehadiran, komposisi departemen, cuti, dan akses cepat.
- Karyawan: nomor induk, kontak, alamat, tanggal bergabung, pencarian/filter, tambah/edit, detail, status, ekspor CSV sesuai filter.
- Profil sendiri: identitas sesuai peran, edit telepon/alamat.
- Absensi: masuk/keluar menurut akun dan tanggal WIB, status terlambat, histori bertanggal, ringkasan dari catatan masuk.
- Cuti: validasi hari kerja, tahun, kuota/reservasi dan bentrok; keputusan manager tim dengan alasan penolakan dan metadata.
- Payroll: komponen nonnegatif, perhitungan bersih, status draft/terbit per periode, snapshot gaji pokok, edit dikunci setelah terbit, slip sendiri setelah terbit dan cetak.
- Kinerja: nilai 0–100, catatan/tanggal/penilai per periode; manager tidak menilai diri sendiri.
- Master departemen/jabatan: tambah, ubah nama dan referensi terkait. Akun: pengaturan peran/status simulasi, identitas penguji dikunci.
- Laporan: rekap CSV dengan escaping kutipan dan perlindungan formula spreadsheet.

Ganti peran melalui pilihan di kanan atas. Admin HR adalah Nadia Putri, Manager adalah Dimas Saputra (tim Engineering), Karyawan adalah Rizky Pratama.

## Batas tahap frontend

Semua nama, email, nominal, presensi, dan penilaian merupakan data fiktif. Data disimpan di memori selama sesi dan kembali ke awal saat refresh. Pemilihan peran dan halaman login hanya simulasi UI, bukan autentikasi atau pengamanan akses. Tidak ada pemrosesan gaji sungguhan. Ringkasan mingguan adalah ilustrasi.

Belum terhubung ke Supabase/database/API. Aturan demo: kuota 12 hari/tahun, Senin–Jumat (tanpa kalender libur nasional), jam 08.00–17.00 WIB. Bukan aturan hukum atau kebijakan HR final. Integrasi backend, autentikasi, RLS, kalender libur, pengujian keamanan, transaksi dan penyimpanan merupakan tahap berikutnya. Pengaturan peran/status akun tidak mengubah hak akses login nyata. Semua akun demo dimulai aktif untuk identitas penguji.

## Desain Figma

[PeopleSpace HRIS — Capstone 4E](https://www.figma.com/design/2IZSe3cKSXkQvXloeJxMGB)

Tiga layar editable: dashboard, daftar karyawan, dan pengajuan cuti; dengan token warna/spacing, gaya teks, dan komponen reusable. Penyempurnaan warna/kontras beberapa tombol Figma tertunda karena batas pemakaian MCP paket Starter. Website memakai styling final sendiri dan tidak mengambil gambar screenshot Figma.

## Teknologi dan struktur

Next.js resmi (App Router) + React + TypeScript, Tailwind CSS, komponen shadcn, ikon Lucide, font Inter lokal. Node.js adalah runtime; Next.js framework. Starter Vinext/Cloudflare lama dipertahankan sebagai berkas pendukung, tetapi tidak digunakan oleh perintah dev/build/start atau deployment Vercel.

- `app/page.tsx`: entry server yang memberi tanggal Jakarta per request, bukan tanggal build.
- `app/hris-app.tsx`: UI, data demo, form, interaksi dan WebMCP navigasi modul.
- `app/globals.css`: tema dan layout responsif.
- `app/layout.tsx`: metadata dan bahasa Indonesia.
- `components/ui/`: komponen UI.
- `public/fonts/`: Inter dengan lisensi SIL Open Font License dari @fontsource/inter.
- `figma-state.json`: referensi desain.
- `lib/hris.ts`: aturan demo yang diuji secara terpisah.
- `tests/`: unit test dan alur browser desktop/ponsel.
- `docs/`: dokumen perencanaan, audit dan konfigurasi deployment.
- `.github/workflows/`: CI dan CD yang menunggu konfigurasi Vercel.

## Verifikasi

Lihat [audit frontend](docs/AUDIT_FRONTEND.md) untuk cakupan pengujian dan pekerjaan yang masih terbuka. Tes otomatis dapat dijalankan ulang melalui perintah di atas; status tiap commit tersedia pada tab Actions GitHub.

Dialog cetak PDF memakai fitur cetak browser; hasil cetak lintas browser belum termasuk jaminan tes otomatis.

## CI/CD

**Frontend CI** berjalan pada push `main` dan pull request. **Deploy Vercel** hanya menerima commit main dari repository ini yang sudah lolos CI, dan hanya aktif setelah konfigurasi. Tidak ada token di repository. Petunjuk aktivasi, rollback dan batasan ada di [panduan deployment](docs/DEPLOYMENT.md). CD yang dilewati karena belum dikonfigurasi bukan deployment sukses.
