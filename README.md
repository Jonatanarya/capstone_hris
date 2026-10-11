# PeopleSpace — HRIS Capstone 4E

Aplikasi HRIS demo Capstone berbasis Next.js + Supabase, berdasarkan `Perencanaan_HRIS_Final_v2.md`, dengan tampilan sederhana, terang, responsif, dan aksen biru.

Deployment memakai mode **live/persisten**, bukan simulasi memori. Mode `demo` offline tetap tersedia untuk pengujian tanpa Supabase. Lihat [panduan presentasi dan alur role](docs/DEMO_CAPSTONE.md) untuk perubahan 11 Oktober 2026.

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

Hanya pada mode offline: ganti peran melalui pilihan di kanan atas (Nadia/Dimas/Rizky). Pada mode live: role ditentukan akun login, termasuk Faisal sebagai HR, Wilda sebagai Manager, dan anggota kelas lain sebagai Karyawan. Tidak ada pemilih role yang memberikan akses nyata.

## Mode dan batas demo

Mode offline (`NEXT_PUBLIC_API_MODE=demo`, default jika tidak ditentukan) memakai fixture fiktif di memori dan kembali ke awal saat refresh. Login, pemilih role, dan chart mingguan pada mode ini adalah simulasi. Untuk tes browser offline, build dengan mode demo terlebih dahulu.

Mode live (`NEXT_PUBLIC_API_MODE=live`) memakai autentikasi Supabase, API same-origin, RLS, transaksi, optimistic version, dan audit. Data tersimpan setelah refresh. Semua role dapat mengajukan cuti, melihat slip pribadi yang terbit, dan mengajukan koreksi absensi; HR mengelola kebijakan/kalender serta riwayat aktivitas. Notifikasi berasal dari data tersimpan dan status dibaca disimpan per akun. Chart kehadiran live memakai catatan tujuh hari terakhir, bukan angka ilustrasi.

Default kebijakan demo: 12 hari/tahun, Senin–Jumat, 08.00–17.00 WIB, laporan sakit mundur maksimal tujuh hari. HR dapat mengubahnya; bukan ketentuan hukum. Alias `@example.test` bukan inbox. Password NIM tetap untuk demo sampai pemilik menggantinya secara opsional. Gaji anggota baru belum diisi; payroll tidak dapat diterbitkan sebelum nominal dilengkapi. Aplikasi tidak melakukan transfer uang, pajak, prorata otomatis, atau penggajian produksi.

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
- `.github/workflows/`: CI demo/live + database disposable, lalu CD Vercel untuk SHA yang lolos.

## Verifikasi

Lihat [audit frontend](docs/AUDIT_FRONTEND.md) untuk cakupan pengujian dan pekerjaan yang masih terbuka. Tes otomatis dapat dijalankan ulang melalui perintah di atas; status tiap commit tersedia pada tab Actions GitHub.

Dialog cetak PDF memakai fitur cetak browser; hasil cetak lintas browser belum termasuk jaminan tes otomatis.

## CI/CD

**Frontend CI** berjalan pada push `main` dan pull request. **Deploy Vercel** hanya menerima commit main dari repository ini yang sudah lolos CI; integrasi proyek ini sudah aktif. Tidak ada token di repository. Petunjuk konfigurasi, rollback dan batasan ada di [panduan deployment](docs/DEPLOYMENT.md). Migrasi Supabase additive diterapkan terpisah setelah dry-run dan regresi rollback-only; deployment aplikasi tidak mereset data.

## Handoff untuk teman backend

[Paket handoff Supabase](docs/backend-handoff/README.md) merupakan rancangan awal v1 dan tidak semuanya mencerminkan implementasi terbaru. Kontrak tambahan, batas role, migrasi 0010–0012 (termasuk KPI bulanan berbobot draf/final), dan skenario UAT terbaru tercatat di [panduan demo](docs/DEMO_CAPSTONE.md). Sumber implementasi aktif adalah route `/api/v1`, migrasi Supabase, dan tes regresi.
