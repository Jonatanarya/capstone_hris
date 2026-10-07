import { test, expect, type Page } from "@playwright/test";
const hr = {
  id: "e0000000-0000-4000-8000-000000000001",
  employeeNo: "EMP-001",
  fullName: "Nadia Putri",
  workEmail: "nadia@example.test",
  department: { id: "dept-hr", name: "Human Resources" },
  position: { id: "pos-hr", name: "HR Specialist" },
  employmentStatus: "ACTIVE",
  joinedOn: "2025-01-06",
  version: 7,
  contact: { phone: "081111111111", address: "Alamat HR", version: 2 },
  compensation: { baseSalaryIdr: 7500000 },
};
const member = {
  ...hr,
  id: "e0000000-0000-4000-8000-000000000004",
  employeeNo: "EMP-004",
  fullName: "Dimas Saputra",
  workEmail: "dimas@example.test",
  department: { id: "dept-eng", name: "Engineering" },
  position: { id: "pos-eng", name: "Frontend Developer" },
  contact: {
    phone: "082222222222",
    address: "Alamat lengkap Dimas",
    version: 3,
  },
  compensation: { baseSalaryIdr: 9500000 },
};
const summary = (employee: typeof hr) => ({
  ...employee,
  contact: undefined,
  compensation: undefined,
});
async function navigate(page: Page, label: string) {
  if (page.viewportSize()!.width < 768)
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page
    .locator('[data-sidebar="menu-button"]')
    .getByText(label, { exact: true })
    .click();
}
async function loginWithMocks(page: Page, brokenDetail = false) {
  let signed = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    let data: unknown = [];
    let status = 200;
    if (path === "/auth/login") signed = true;
    if (path === "/me" || path === "/auth/login") {
      data = {
        userId: "hr-user",
        role: "ADMIN_HR",
        accountStatus: "ACTIVE",
        employee: hr,
      };
      if (!signed) status = 401;
    } else if (path === "/employees") data = [summary(hr), summary(member)];
    else if (path.startsWith("/employees/")) {
      data = path.endsWith(member.id) ? member : hr;
      if (brokenDetail) status = 503;
    } else if (path === "/departments")
      data = [
        {
          id: "dept-hr",
          name: "Human Resources",
          status: "ACTIVE",
          version: 1,
        },
        { id: "dept-eng", name: "Engineering", status: "ACTIVE", version: 1 },
        {
          id: "dept-unused",
          name: "Departemen tanpa karyawan",
          status: "ACTIVE",
          version: 1,
        },
      ];
    else if (path === "/positions")
      data = [
        { id: "pos-hr", name: "HR Specialist", status: "ACTIVE", version: 1 },
        {
          id: "pos-eng",
          name: "Frontend Developer",
          status: "ACTIVE",
          version: 1,
        },
      ];
    else if (path === "/accounts")
      data = [
        {
          userId: "hr-user",
          employeeId: hr.id,
          fullName: hr.fullName,
          workEmail: hr.workEmail,
          role: "ADMIN_HR",
          accountStatus: "ACTIVE",
          version: 4,
        },
        {
          userId: "mgr-user",
          employeeId: member.id,
          fullName: member.fullName,
          workEmail: member.workEmail,
          role: "MANAGER",
          accountStatus: "ACTIVE",
          version: 3,
        },
      ];
    else if (path === "/dashboard")
      data = {
        employeeCount: 2,
        activeEmployeeCount: 2,
        presentCount: 0,
        pendingLeaveCount: 0,
        averageReviewScore: null,
        reviewedEmployeeCount: 0,
      };
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status >= 400
          ? {
              error: {
                code:
                  status === 401 ? "UNAUTHENTICATED" : "SERVICE_UNAVAILABLE",
                message: "Detail gagal dimuat",
              },
              meta: {},
            }
          : {
              data,
              meta: {
                total: Array.isArray(data) ? data.length : undefined,
                totalPages: 1,
              },
            },
      ),
    });
  });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("nadia@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-mocked-not-a-real-password");
  await page
    .getByRole("button", { name: "Masuk ke workspace", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Notifikasi", exact: true }),
  ).toBeVisible();
}
test("live edit uses complete detail, never zero salary from summary", async ({
  page,
}) => {
  await loginWithMocks(page);
  await navigate(page, "Karyawan");
  await page
    .getByRole("row")
    .filter({ hasText: "Dimas Saputra" })
    .getByRole("button", { name: "Detail Dimas Saputra", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit karyawan", exact: true })
    .click();
  await expect(page.getByLabel("Telepon", { exact: true })).toHaveValue(
    member.contact.phone,
  );
  await expect(page.getByLabel("Alamat", { exact: true })).toHaveValue(
    member.contact.address,
  );
  await expect(page.getByLabel("Gaji pokok", { exact: true })).toHaveValue(
    "9500000",
  );
  await expect(page.getByLabel("Nomor induk", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("live account roles and unused masters come from API; no fake reviews", async ({
  page,
}) => {
  await loginWithMocks(page);
  await navigate(page, "Akun pengguna");
  await expect(
    page.getByRole("combobox", { name: "Peran akun Nadia Putri" }),
  ).toHaveValue("Admin HR");
  await expect(
    page.getByRole("combobox", { name: "Peran akun Nadia Putri" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Peran akun Dimas Saputra" }),
  ).toHaveValue("Manager");
  await navigate(page, "Departemen");
  await expect(
    page.getByRole("heading", {
      name: "Departemen tanpa karyawan",
      exact: true,
    }),
  ).toBeVisible();
  await navigate(page, "Penilaian kinerja");
  await expect(
    page.getByText("Penilaian contoh September", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Belum ada penilaian untuk periode ini.", { exact: true }),
  ).toHaveCount(2);
});
test("missing detail fails closed, not a blank destructive edit form", async ({
  page,
}) => {
  await loginWithMocks(page, true);
  await navigate(page, "Karyawan");
  await page
    .getByRole("row")
    .filter({ hasText: "Dimas Saputra" })
    .getByRole("button", { name: "Detail Dimas Saputra", exact: true })
    .click();
  await expect(
    page.getByText("Detail gagal dimuat", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("real server rejects cross-origin mutations and unsigned password flow", async ({
  request,
}) => {
  const forged = await request.post("/api/v1/auth/logout", {
    headers: { Origin: "https://evil.test", "X-HRIS-Request": "1" },
  });
  expect(forged.status()).toBe(403);
  const noFlow = await request.post("/api/v1/auth/password", {
    headers: { Origin: "http://127.0.0.1:5173", "X-HRIS-Request": "1" },
    data: { password: "local-test-only-not-saved" },
  });
  expect(noFlow.status()).toBe(403);
  const recovery = await request.get("/auth/recovery");
  expect(recovery.status()).toBe(200);
});
