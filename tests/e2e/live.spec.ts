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
type PayrollFixture = {
  salary: number;
  published?: boolean;
  notReady?: boolean;
  readinessError?: boolean;
  publishCount?: number;
  syncCount?: number;
};
async function navigate(page: Page, label: string) {
  if (page.viewportSize()!.width < 768)
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page
    .locator('[data-sidebar="menu-button"]')
    .getByText(label, { exact: true })
    .click();
}
async function loginWithMocks(
  page: Page,
  brokenDetail = false,
  identifier = "nadia@example.test",
  payrollFixture?: PayrollFixture,
) {
  let signed = false;
  let payrollPublished = payrollFixture?.published ?? false;
  let payrollVersion = 1;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    let data: unknown = [];
    let status = 200;
    if (path === "/auth/login") {
      expect(route.request().postDataJSON()).toMatchObject({ identifier });
      signed = true;
    }
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
      if (payrollFixture && path.endsWith(member.id))
        data = {
          ...member,
          compensation: { baseSalaryIdr: payrollFixture.salary },
        };
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
    else if (payrollFixture && path === "/payroll-runs")
      data = [
        {
          id: "a0000000-0000-4000-8000-000000000001",
          period: url.searchParams.get("period"),
          status: payrollPublished ? "PUBLISHED" : "DRAFT",
          publishedAt: null,
          version: payrollVersion,
        },
      ];
    else if (payrollFixture && path.endsWith("/readiness")) {
      data = {
        status: "DRAFT",
        ready: payrollFixture.salary > 0 && !payrollFixture.notReady,
        missingSalaryCount: payrollFixture.salary > 0 ? 0 : 1,
        missingSalaryEmployees:
          payrollFixture.salary > 0
            ? []
            : [
                {
                  id: member.id,
                  employeeNo: member.employeeNo,
                  fullName: member.fullName,
                },
              ],
        missingItemCount: 0,
        inactiveItemCount: 0,
        staleItemCount: payrollFixture.notReady ? 1 : 0,
        invalidDeductionCount: 0,
        itemCount: 1,
        activeEmployeeCount: 1,
      };
      if (payrollFixture.readinessError) status = 503;
    } else if (payrollFixture && path.endsWith("/items"))
      data = [
        {
          id: "a0000000-0000-4000-8000-000000000002",
          payrollRunId: "a0000000-0000-4000-8000-000000000001",
          employeeId: member.id,
          employeeNo: member.employeeNo,
          fullName: member.fullName,
          departmentName: member.department.name,
          positionName: member.position.name,
          baseSalaryIdr: payrollFixture.salary,
          allowanceIdr: 0,
          bonusIdr: 0,
          deductionIdr: 0,
          netSalaryIdr: payrollFixture.salary,
          status: payrollPublished ? "PUBLISHED" : "DRAFT",
          version: 1,
        },
      ];
    else if (payrollFixture && path.endsWith("/sync")) {
      expect(route.request().postDataJSON()).toEqual({
        expectedVersion: payrollVersion,
      });
      payrollFixture.syncCount = (payrollFixture.syncCount ?? 0) + 1;
      payrollFixture.notReady = false;
      payrollVersion++;
      data = {
        id: "a0000000-0000-4000-8000-000000000001",
        status: "DRAFT",
        version: payrollVersion,
      };
    } else if (payrollFixture && path.endsWith("/publish")) {
      payrollFixture.publishCount = (payrollFixture.publishCount ?? 0) + 1;
      expect(route.request().postDataJSON()).toEqual({
        expectedVersion: payrollVersion,
      });
      payrollPublished = true;
      payrollVersion++;
      data = {
        id: "a0000000-0000-4000-8000-000000000001",
        status: "PUBLISHED",
        version: payrollVersion,
      };
    } else if (path === "/dashboard")
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
  await page.getByLabel("NIM / NPM", { exact: true }).fill(identifier);
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
test("numeric NIM login is submitted without HTML email validation", async ({
  page,
}) => {
  await loginWithMocks(page, false, "2300000001");
  await expect(
    page.getByRole("button", { name: "Notifikasi", exact: true }),
  ).toBeVisible();
});

test("live empty payroll does not fabricate zero-salary rows from the directory", async ({
  page,
}) => {
  await loginWithMocks(page);
  await navigate(page, "Payroll");
  await expect(
    page.getByText("Belum ada item payroll periode ini.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buat payroll", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Tinjau draft", exact: true }),
  ).toHaveCount(0);
});

test("live payroll preview uses snapshot base salary even though the directory lacks compensation", async ({
  page,
}) => {
  await loginWithMocks(page, false, "nadia@example.test", { salary: 9000000 });
  await navigate(page, "Payroll");
  await expect(
    page.getByRole("cell", { name: "Rp 9.000.000", exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("row").filter({ hasText: hr.fullName }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit komponen Dimas Saputra", exact: true })
    .click();
  await page.getByLabel("Tunjangan", { exact: true }).fill("500000");
  await page.getByLabel("Bonus", { exact: true }).fill("250000");
  await page.getByLabel("Potongan", { exact: true }).fill("100000");
  await expect(
    page.getByRole("dialog").locator(".payroll-total"),
  ).toContainText("Rp 9.650.000");
});

test("zero salary is visibly unconfigured and cannot be published", async ({
  page,
}) => {
  await loginWithMocks(page, false, "nadia@example.test", { salary: 0 });
  await navigate(page, "Payroll");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Payroll belum siap diterbitkan" }),
  ).toContainText("1 karyawan belum memiliki gaji pokok");
  await expect(
    page.getByRole("cell", { name: "Belum diisi", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Terbitkan payroll", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Tinjau draft", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Belum siap");
  await expect(
    page.getByRole("button", { name: "Cetak atau simpan PDF", exact: true }),
  ).toBeDisabled();
});

test("stale draft requires explicit synchronization without automatically publishing", async ({
  page,
}) => {
  const fixture: PayrollFixture = { salary: 9000000, notReady: true };
  await loginWithMocks(page, false, "nadia@example.test", fixture);
  await navigate(page, "Payroll");
  await expect(
    page.getByRole("button", { name: "Terbitkan payroll", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Sinkronkan draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Terbitkan payroll", exact: true }),
  ).toBeEnabled();
  expect(fixture.syncCount).toBe(1);
  expect(fixture.publishCount ?? 0).toBe(0);
  await expect(
    page.getByRole("button", { name: "Tinjau draft", exact: true }),
  ).toBeVisible();
});

test("payroll publication requires explicit confirmation and then locks the run", async ({
  page,
}) => {
  const fixture: PayrollFixture = { salary: 9000000, publishCount: 0 };
  await loginWithMocks(page, false, "nadia@example.test", fixture);
  await navigate(page, "Payroll");
  await page
    .getByRole("button", { name: "Terbitkan payroll", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "tidak mentransfer uang",
  );
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  expect(fixture.publishCount).toBe(0);
  await page
    .getByRole("button", { name: "Terbitkan payroll", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ya, terbitkan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Payroll diproses", exact: true }),
  ).toBeDisabled();
  expect(fixture.publishCount).toBe(1);
  await expect(
    page.getByRole("button", { name: "Sinkronkan draft", exact: true }),
  ).toHaveCount(0);
});

test("readiness API failure fails closed without ghost payroll rows", async ({
  page,
}) => {
  await loginWithMocks(page, false, "nadia@example.test", {
    salary: 9000000,
    readinessError: true,
  });
  await navigate(page, "Payroll");
  await expect(
    page.getByRole("button", { name: "Muat ulang payroll", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buat payroll", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Tinjau draft", exact: true }),
  ).toHaveCount(0);
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

test("default invite bridge strips fragment and rejects missing tokens without posting", async ({
  page,
}) => {
  let posted = false;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/auth/confirm")) posted = true;
  });
  await page.goto(
    "/auth/confirm?type=invite#type=invite&access_token=not-a-valid-token",
  );
  await expect(page.getByRole("status")).toContainText("Tautan tidak valid");
  expect(new URL(page.url()).hash).toBe("");
  expect(posted).toBe(false);
});

test("default invite bridge sends tokens only to same-origin server and surfaces rejection", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/confirm", async (route) => {
    expect(route.request().headers()["x-hris-request"]).toBe("1");
    expect(route.request().postDataJSON()).toEqual({
      access_token: "test-only-access",
      refresh_token: "test-only-refresh",
    });
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Undangan ditolak" } }),
    });
  });
  await page.goto(
    "/auth/confirm?type=invite#type=invite&access_token=test-only-access&refresh_token=test-only-refresh",
  );
  await expect(page.getByRole("status")).toHaveText("Undangan ditolak");
  expect(new URL(page.url()).hash).toBe("");
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
});
