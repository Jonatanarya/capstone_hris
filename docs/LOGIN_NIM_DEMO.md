# Login NIM/NPM — demo kelas

Login menerima `{ identifier, password }`; `identifier` dapat berisi NIM/NPM atau nomor induk karyawan. Request lama `{ email, password }` tetap didukung, tetapi dua identifier sekaligus, field tidak dikenal, serta role/userId dari browser ditolak.

Server memetakan nomor induk secara exact ke alamat internal yang diperlukan Supabase Auth. Pencarian ini tidak memiliki endpoint publik tersendiri. Password tetap diverifikasi Supabase, lalu role/status akun dan status karyawan dibaca dari database. Identitas yang tidak ditemukan dan password yang salah mendapat pesan invalid credentials generik; akun disabled/inactive tetap ditolak dan cookie baru dibersihkan.

Roster yang diminta pengguna: 40 orang, terdiri dari 38 EMPLOYEE, satu MANAGER, dan satu ADMIN_HR. Nama/NIM/password tidak dimasukkan ke GitHub publik. Data privat provisioning tersimpan lokal di folder `work/` yang diabaikan Git.

Pengguna secara eksplisit meminta password awal sama dengan NIM/NPM. Ini hanya untuk demonstrasi, **bukan kebijakan aman untuk produksi**. Password tidak disimpan di tabel employee/profile maupun kode frontend, dan tidak dicetak oleh provisioning. Akun lama tidak ditimpa atau direset. Tidak ada email undangan yang dikirim.

Kolom yang tidak diberikan adalah dummy: departemen `Demo Kelas 4E`, jabatan `Karyawan Demo`, gaji pokok Rp0, kontak `Belum diisi`, serta tanggal bergabung tanggal impor di Asia/Jakarta (bukan riwayat kerja faktual). Roster memakai alias `<nomor-induk>@example.test`; alamat ini bukan inbox nyata. Akun tersebut tidak dapat menerima email reset. Untuk demo hubungi HR/operator; sebelum produksi gunakan password unik dan jalur pemulihan identitas yang terverifikasi.

Provisioning memvalidasi duplikat dan role, mencoba transaksi employee dengan rollback terlebih dahulu, membuat employee/contact/compensation/audit secara atomik, membuat identitas Auth tanpa email, lalu menyambungkan profile dalam transaksi. Retry hanya memakai identitas bertanda batch yang sama; tidak menghapus akun atau mengganti password. Kegagalan antara Auth dan profile memerlukan retry/rekonsiliasi operator, bukan pengiriman email ulang.

## Verifikasi

- 94 unit/API mock test lulus (termasuk mapping exact NIM, email legacy, role tampering, password salah, serta penolakan akun inactive/disabled).
- 14 browser test live desktop/mobile lulus; data API dimock, dan input angka NIM tidak ditolak HTML email validation. Mode demo memiliki 12 tes browser terpisah pada CI.
- 39 database regression assertion pada project terkonfigurasi lulus; semua transaksi regression di-rollback.
- Provisioning/readback 40 profile ACTIVE berhasil: 38 EMPLOYEE, 1 MANAGER, 1 ADMIN_HR. Employee sekarang berjumlah 50 termasuk 10 fixture lama; profile akun 47 termasuk 7 akun lama. Payroll yang sudah ada tidak diubah.
- Pipeline memverifikasi kedua mode dan database terisolasi sebelum deploy main. Status commit terbaru tersedia di [GitHub Actions](https://github.com/Jonatanarya/capstone_hris/actions).
