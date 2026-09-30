import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PeopleSpace — HRIS Capstone 4E",
  description:
    "Frontend HRIS untuk data karyawan, presensi, cuti, payroll, dan penilaian kinerja. Capstone Project kelas 4E.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/peoplespace.svg",
    shortcut: "/peoplespace.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
