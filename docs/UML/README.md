# UML revisi HRIS - 11 Oktober 2026

> Arsip sebelum revisi dosen 19 Oktober 2026. PDF/model v3 belum mencerminkan Manager sebagai pembuat target saja, HR sebagai penilai/pemutus cuti, rekap bulanan, dan tes pelamar. Untuk aturan aplikasi terbaru gunakan [revisi dosen](../REVISI_DOSEN_2026-10-19.md); jangan menjadikan diagram lama sebagai acuan otorisasi.

Paket ini melengkapi model akademik lama di folder UML proyek, tanpa menimpa .oom/.oob maupun PDF asli. Acuan: PRD bagian 23 dan 27, route API, migrasi 0001–0013.

- [Laporan PDF](../../output/pdf/UML_Revisi_HRIS_v3.pdf): perencanaan, Use Case per role, Activity cuti/KPI, Sequence cuti/payroll/KPI, Class Diagram domain, dan keterlacakan FR.
- [Sumber diagram/render](../../scripts/render-uml-report.py): diagram vektor yang dapat diedit/dihasilkan ulang; bukan file PowerDesigner yang telah disunting.

Use Case memperlihatkan layanan pribadi bersama dan kewenangan khusus. Activity memisahkan pelaku dan sistem. Sequence menggunakan lifeline, pesan bernomor dan respons. Class menggunakan atribut, operasi domain dan kardinalitas; ini model konseptual, bukan klaim setiap metode adalah fungsi yang persis sama di kode. Relasi kompensasi/audit ditandai private.

Untuk menghasilkan ulang, jalankan Python dengan reportlab dan pypdf pada runtime dokumen, lalu render PDF ke PNG memakai pdftoppm untuk verifikasi visual. Tidak membutuhkan kredensial Supabase. PDF harus diperiksa kembali setelah perubahan tata letak.

Mencakup FR46–FR56: layanan pribadi, fallback HR/no self-approval, CANCELLED, kalender/koreksi, notifikasi/audit, KPI target aman/immutable, HR menilai Manager. Tidak mengklaim pajak/BPJS/transfer bank, histori effective salary, GPS/fingerprint, delegasi atau kalibrasi KPI sudah tersedia.
