# PeopleSpace — HRIS Capstone 4E

Frontend HRIS berdasarkan `Perencanaan_HRIS_Final_v2.md`, dengan tampilan sederhana, terang, responsif, dan aksen biru.

## Menjalankan

Butuh Node.js 22.13 atau lebih baru.

```sh
npm install
npm run dev
```

Buka http://localhost:5173. Untuk pemeriksaan: `npx tsc --noEmit` dan `npm run build`.

## Fitur demo

- Dashboard: ringkasan karyawan, kehadiran, komposisi departemen, cuti, dan akses cepat.
- Karyawan: pencarian, filter departemen, tambah/edit, detail, status aktif/nonaktif, ekspor CSV.
- Absensi: absen masuk/keluar dan catatan kehadiran.
- Cuti: formulir dengan validasi tanggal dan kuota, daftar status, persetujuan/penolakan manager.
- Payroll: gaji pokok + tunjangan + bonus − potongan, edit komponen, slip gaji dan cetak.
- Kinerja: nilai 0–100, catatan manager, dan hasil penilaian karyawan.
- Master data departemen/jabatan: daftar dan penambahan. Akun pengguna: daftar demo.
- Laporan: unduh rekap CSV.

Ganti peran melalui pilihan di kanan atas. Admin HR adalah Nadia Putri, Manager adalah Dimas Saputra (tim Engineering), Karyawan adalah Rizky Pratama.

## Batas tahap frontend

Semua nama, email, nominal, presensi, dan penilaian merupakan data fiktif. Data disimpan di memori selama sesi dan kembali ke awal saat refresh. Pemilihan peran dan halaman login hanya simulasi UI, bukan autentikasi atau pengamanan akses. Tidak ada pemrosesan gaji sungguhan. Ringkasan mingguan adalah ilustrasi.

Belum terhubung ke Supabase/database/API. Integrasi backend, autentikasi, RLS, aturan cuti/hari kerja, pengujian keamanan, dan deployment merupakan tahap berikutnya.

## Desain Figma

[PeopleSpace HRIS — Capstone 4E](https://www.figma.com/design/2IZSe3cKSXkQvXloeJxMGB)

Tiga layar editable: dashboard, daftar karyawan, dan pengajuan cuti; dengan token warna/spacing, gaya teks, dan komponen reusable. Penyempurnaan warna/kontras beberapa tombol Figma tertunda karena batas pemakaian MCP paket Starter. Website memakai styling final sendiri dan tidak mengambil gambar screenshot Figma.

## Teknologi dan struktur

React + TypeScript, App Router kompatibel Next.js melalui Vinext/Vite, Tailwind CSS, komponen shadcn, ikon Lucide, font Inter lokal.

- `app/page.tsx`: UI, data demo, validasi form, interaksi dan WebMCP navigasi modul.
- `app/globals.css`: tema dan layout responsif.
- `app/layout.tsx`: metadata dan bahasa Indonesia.
- `components/ui/`: komponen UI.
- `public/fonts/`: Inter dengan lisensi SIL Open Font License dari @fontsource/inter.
- `figma-state.json`: referensi desain.

## Verifikasi

TypeScript dan build berhasil. Alur browser yang diuji: tambah/cari karyawan, pergantian peran, pembatasan data tim, persetujuan cuti, check-in/out, pengajuan cuti, slip gaji, penilaian, edit/perhitungan payroll, serta WebMCP navigasi. Layout diuji pada lebar 1440 dan 390 piksel; halaman tidak melebar di luar viewport ponsel, navigasi ponsel menutup otomatis, dan tidak ada error console pada pemeriksaan akhir.

Ekspor CSV dibuat oleh frontend; otomatisasi unduhan di browser preview tidak memberikan konfirmasi selesai. Pemeriksaan cetak PDF dilakukan oleh pengguna melalui dialog cetak browser.
