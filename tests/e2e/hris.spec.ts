import { test, expect, type Page } from "@playwright/test";
import { jakartaDate } from "../../lib/hris";
const errors = new WeakMap<Page, string[]>();
async function navigate(page: Page, label: string) {
  if (page.viewportSize()!.width < 768)
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page
    .locator('[data-sidebar="menu-button"]')
    .getByText(label, { exact: true })
    .click();
}
async function role(page: Page, value: string) {
  await page.getByRole("combobox", { name: "Ganti peran demo" }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (error) => errors.get(page)!.push(error.message));
  await page.goto("/");
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
test("profil, pembatasan tim, dan layout tidak meluber", async ({
  page,
}, testInfo) => {
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  await navigate(page, "Profil saya");
  await expect(
    page.getByRole("heading", { name: "Nadia Putri", exact: true }),
  ).toBeVisible();
  await role(page, "Manager");
  await navigate(page, "Anggota tim");
  await expect(
    page.getByRole("cell", { name: /RP Rizky Pratama/ }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: /Alya Maharani/ })).toHaveCount(
    0,
  );
  await navigate(page, "Penilaian kinerja");
  await expect(
    page.getByRole("button", { name: "Beri penilaian" }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("absensi sendiri sekali masuk/keluar, histori dan CSV", async ({
  page,
}) => {
  await role(page, "Karyawan");
  await navigate(page, "Absensi");
  await page.getByRole("button", { name: "Absen masuk", exact: true }).click();
  await page.getByRole("button", { name: "Absen keluar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Absensi selesai" }),
  ).toBeDisabled();
  await page.getByLabel("Tanggal kehadiran").fill("2026-09-30");
  await expect(
    page.getByRole("cell", { name: "17:00", exact: true }),
  ).toBeVisible();
  await role(page, "Admin HR");
  await navigate(page, "Karyawan");
  const result = page.waitForEvent("download");
  await page.getByRole("button", { name: /Ekspor/ }).click();
  expect((await result).suggestedFilename()).toMatch(/\.csv$/);
});
test("payroll terbit per periode dan tidak tampil sebelum diterbitkan", async ({
  page,
}) => {
  await role(page, "Karyawan");
  await navigate(page, "Slip gaji saya");
  await expect(
    page.getByRole("button", { name: "Slip gaji", exact: true }),
  ).toHaveCount(0);
  await role(page, "Admin HR");
  await navigate(page, "Payroll");
  await page
    .getByRole("button", { name: "Proses payroll", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Payroll diproses" }),
  ).toBeDisabled();
  await page.getByRole("combobox", { name: "Periode payroll" }).click();
  await page.getByRole("option", { name: "Agustus 2026", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Proses payroll", exact: true }),
  ).toBeEnabled();
  await page.getByRole("combobox", { name: "Periode payroll" }).click();
  await page
    .getByRole("option", { name: "September 2026", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Payroll diproses" }),
  ).toBeDisabled();
  await role(page, "Karyawan");
  await navigate(page, "Slip gaji saya");
  await page.getByRole("button", { name: "Slip gaji", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Rp 9.750.000");
});
test("pengajuan cuti berhasil dan pengajuan bentrok ditolak", async ({
  page,
}) => {
  const next = new Date(jakartaDate() + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + 14);
  while ([0, 6].includes(next.getUTCDay()))
    next.setUTCDate(next.getUTCDate() + 1);
  const start = next.toISOString().slice(0, 10);
  await role(page, "Karyawan");
  await navigate(page, "Pengajuan cuti");
  for (let attempt = 0; attempt < 2; attempt++) {
    await page
      .getByRole("button", { name: "Ajukan cuti", exact: true })
      .click();
    await page.getByLabel("Tanggal mulai", { exact: true }).fill(start);
    await page.getByLabel("Tanggal selesai", { exact: true }).fill(start);
    await page
      .getByLabel("Alasan", { exact: true })
      .fill("Keperluan pengujian");
    await page
      .getByRole("button", { name: "Kirim pengajuan", exact: true })
      .click();
    if (attempt === 0) {
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("cell", { name: /Keperluan pengujian/ }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText("Tanggal bentrok dengan pengajuan yang masih aktif", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toBeVisible();
    }
  }
});
test("tambah karyawan lengkap, duplikasi dan ubah master", async ({
  page,
}, testInfo) => {
  await navigate(page, "Karyawan");
  await page
    .getByRole("button", { name: "Tambah karyawan", exact: true })
    .click();
  await page.getByLabel("Nomor induk", { exact: true }).fill("EMP-009");
  await page.getByLabel("Telepon", { exact: true }).fill("081234567890");
  await page.getByLabel("Alamat", { exact: true }).fill("Alamat demo Bandung");
  await page
    .getByLabel("Nama lengkap", { exact: true })
    .fill("Karyawan Penguji");
  await page
    .getByLabel("Email", { exact: true })
    .fill("penguji@peoplespace.demo");
  await page
    .getByRole("textbox", { name: "Jabatan", exact: true })
    .fill("Frontend Developer");
  await page.screenshot({
    path: testInfo.outputPath("employee-form.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: /KP Karyawan Penguji/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tambah karyawan", exact: true })
    .click();
  await page.getByLabel("Nomor induk", { exact: true }).fill("EMP-009");
  await page.getByLabel("Telepon", { exact: true }).fill("081234567891");
  await page.getByLabel("Alamat", { exact: true }).fill("Alamat demo");
  await page
    .getByLabel("Nama lengkap", { exact: true })
    .fill("Penguji Duplikat");
  await page
    .getByLabel("Email", { exact: true })
    .fill("duplikat@peoplespace.demo");
  await page
    .getByRole("textbox", { name: "Jabatan", exact: true })
    .fill("Frontend Developer");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(
    page.getByText("Nomor induk sudah digunakan", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await navigate(page, "Departemen");
  const engineering = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Engineering", exact: true }),
  });
  await engineering.getByRole("button", { name: "Ubah nama" }).click();
  await page.getByLabel("Nama", { exact: true }).fill("Teknologi");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await role(page, "Manager");
  await navigate(page, "Anggota tim");
  await expect(
    page.getByRole("cell", { name: /RP Rizky Pratama/ }),
  ).toBeVisible();
});
test("penolakan cuti punya alasan dan hasil kinerja terpisah per periode", async ({
  page,
}) => {
  await role(page, "Manager");
  await navigate(page, "Pengajuan cuti");
  await page.getByRole("button", { name: "Tolak", exact: true }).click();
  await page
    .getByLabel("Alasan penolakan", { exact: true })
    .fill("Jadwal tim belum memungkinkan");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(
    page.getByText("Alasan: Jadwal tim belum memungkinkan", { exact: true }),
  ).toBeVisible();
  await navigate(page, "Penilaian kinerja");
  await page.getByRole("combobox", { name: "Periode penilaian" }).click();
  await page.getByRole("option", { name: "Oktober 2026", exact: true }).click();
  await page.getByRole("button", { name: "Beri penilaian" }).click();
  await page.getByLabel("Nilai (0 – 100)", { exact: true }).fill("94");
  await page.getByLabel("Catatan", { exact: true }).fill("Target tim tercapai");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await role(page, "Karyawan");
  await navigate(page, "Penilaian kinerja");
  await expect(
    page.getByText("Target tim tercapai", { exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Periode penilaian" }).click();
  await page
    .getByRole("option", { name: "September 2026", exact: true })
    .click();
  await expect(
    page.getByText("Target tim tercapai", { exact: true }),
  ).toHaveCount(0);
});
