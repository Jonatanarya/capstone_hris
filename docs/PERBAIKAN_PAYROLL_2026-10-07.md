# Perbaikan alur payroll — 7 Oktober 2026

## Penyebab gaji terlihat Rp0

Ada dua hal berbeda: gaji pokok 40 akun kelas memang belum diisi karena nominalnya tidak diberikan, dan frontend sebelumnya memakai daftar ringkas karyawan sebagai cadangan baris payroll. Daftar ringkas sengaja tidak membawa informasi gaji. Baris cadangan tersebut dapat menampilkan Rp0 meskipun payroll belum dibuat atau gaji sebenarnya tersedia di detail/snapshot.

Perbaikan tidak mengisi gaji dengan nominal rekaan. Pada MVP, gaji pokok 0 berarti belum dikonfigurasi untuk penerbitan payroll. Jika kelak ada jenis hubungan kerja yang memang bergaji pokok 0, kebijakannya harus dirancang terpisah; tidak menggunakan 0 sebagai penanda dua keadaan berbeda.

## Alur Admin HR

1. Buka detail karyawan, isi gaji pokok sesuai data yang disepakati.
2. Pilih periode dan buat payroll. Sistem membuat draft untuk karyawan aktif, bukan langsung menerbitkan atau mentransfer uang.
3. Jika karyawan/gaji/jabatan/departemen berubah sesudah draft dibuat, pilih **Sinkronkan draft**. Gaji pokok dan identitas snapshot diperbarui, karyawan aktif baru ditambahkan, item karyawan yang sekarang nonaktif dikeluarkan dari draft. Tunjangan, bonus, dan potongan item yang tetap ada dipertahankan.
4. Periksa komponen setiap karyawan. Gaji bersih = gaji pokok + tunjangan + bonus − potongan. Potongan tidak boleh melebihi bruto; seluruh komponen rupiah harus bilangan bulat tidak negatif.
5. Terbitkan setelah pemeriksaan kesiapan menyatakan semua gaji pokok terisi (>0), item sesuai karyawan aktif, snapshot mutakhir, dan potongan valid. Konfirmasi akhir wajib; sinkronisasi tidak otomatis menerbitkan.
6. Setelah terbit, snapshot dikunci. Perubahan data karyawan selanjutnya tidak mengubah slip lama. Karyawan hanya melihat slip dirinya yang sudah terbit; Manager tidak mempunyai akses payroll sesuai scope PRD.

Perhitungan tunjangan, bonus, dan potongan masih manual. Tidak ada transfer bank otomatis maupun perhitungan pajak/BPJS otomatis dalam perubahan ini.

## Pengaman frontend dan database

- Tabel mengambil item payroll asli saja, bukan menebak dari direktori. Periode tanpa payroll menunjukkan keadaan kosong. Gagal mengambil data tidak diperlakukan sebagai data kosong yang berhasil.
- Preview memakai gaji pokok snapshot payroll, bukan salary pada EmployeeSummary. Draft bergaji 0 menampilkan **Belum diisi/Belum siap**. Cetak slip hanya tersedia setelah terbit.
- Response periode lama tidak dapat menimpa state periode terbaru. Tombol aksi dinonaktifkan selama memuat/menyimpan atau ketika kesiapan gagal dimuat.
- Validasi penerbitan wajib berjalan lagi di database, di bawah penguncian yang juga dipakai perubahan data HR. Memanggil API langsung tidak melewati pengaman gaji belum lengkap.
- Sinkronisasi, edit komponen, dan publish memakai versi. Edit komponen juga menaikkan versi run agar penerbitan dengan data lama ditolak.
- Migration `0009_payroll_readiness.sql` hanya menambah/memperkuat fungsi dan permission. Tidak mengubah nominal gaji, akun, item payroll, atau riwayat terbit yang ada.

## Kontrak tambahan

`GET /api/v1/payroll-runs/{id}/readiness` khusus Admin HR aktif. Envelope `data` memuat:

```json
{
  "status": "DRAFT",
  "ready": false,
  "missingSalaryCount": 1,
  "missingSalaryEmployees": [
    { "id": "employee-uuid", "employeeNo": "EMP-001", "fullName": "Contoh" }
  ],
  "missingItemCount": 0,
  "inactiveItemCount": 0,
  "staleItemCount": 0,
  "invalidDeductionCount": 0,
  "itemCount": 1,
  "activeEmployeeCount": 1
}
```

Daftar `missingSalaryEmployees` dibatasi 20 orang; count tetap mencakup semuanya. Run terbit mengembalikan `ready: false`, status `PUBLISHED`, jumlah item riwayat; diagnostik draft dan activeEmployeeCount bernilai 0 (bukan jumlah karyawan aktif organisasi).

`POST /api/v1/payroll-runs/{id}/sync` khusus HR, body `{"expectedVersion": 2}`; mengembalikan PayrollRun versi terbaru. Konflik versi: 409 `VERSION_CONFLICT`; sudah terbit: 409 `PAYROLL_ALREADY_PUBLISHED`; potongan tidak valid terhadap gaji terkini: 422 `VALIDATION_ERROR` dan seluruh sinkronisasi dibatalkan.

`POST /api/v1/payroll-runs/{id}/publish` tetap memakai expectedVersion, tetapi sekarang mengembalikan 422 **PAYROLL_NOT_READY** bila pemeriksaan kesiapan gagal. Frontend memuat ulang kesiapan/versi setelah publish ditolak. Kedua mutation harus memakai pengaman same-origin yang sudah ada (`Origin`, `X-HRIS-Request: 1`).

## Verifikasi

Validasi lokal: 114 unit/API tests, 56 pemeriksaan database, 26 E2E live dan 12 E2E demo (desktop/ponsel) lulus, berikut lint, typecheck, serta build kedua mode. Probe rollback dengan nominal produksi juga memastikan draft 47 karyawan aktif mendeteksi 40 gaji belum diisi dan menolak publish. Checksum payroll runs, items, dan kompensasi dibandingkan sebelum/sesudah migration dan pengujian: tidak berubah.

Unit/API tests mencakup rumus preview, nilai invalid, gaji belum terisi, error kesiapan, role, dan validasi versi. Tes database mencakup publish gaji 0/stale, karyawan baru/nonaktif, sinkronisasi, potongan, versi agregat, permission, serta snapshot terbit yang tetap terkunci. Tes database sengaja membatalkan seluruh perubahan bisnis dan audit, termasuk nominal gaji fixture, di akhir transaksi.

E2E desktop/ponsel menguji periode kosong tanpa baris rekaan, preview gaji dari snapshot, blokir gaji 0, sinkronisasi eksplisit, konfirmasi publish, kunci setelah terbit, dan kegagalan readiness yang menutup aksi. CI menjalankan build/test mode demo dan live serta database terisolasi; CD Vercel berjalan hanya setelah CI berhasil.
