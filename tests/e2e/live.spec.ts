import { test, expect, type Page } from "@playwright/test";
import { kpiTemplate, kpiScore, type KpiDto } from "../../lib/kpi";
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
  businessRole: "ADMIN_HR" | "MANAGER" | "EMPLOYEE" = "ADMIN_HR",
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
        role: businessRole,
        accountStatus: "ACTIVE",
        employee: businessRole === "ADMIN_HR" ? hr : member,
      };
      if (!signed) status = 401;
    } else if (path === "/me/leave-balance") data = { availableDays: 12 };
    else if (path === "/hr-policy")
      data = {
        workStart: "08:00",
        workEnd: "17:00",
        workingDays: [1, 2, 3, 4, 5],
        holidayDates: [],
        defaultEntitlement: 12,
        sickBackdateDays: 7,
        version: 1,
      };
    else if (path === "/employees") data = [summary(hr), summary(member)];
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

for (const role of ["ADMIN_HR", "MANAGER", "EMPLOYEE"] as const) {
  test(`${role} has personal payroll, correction and optional password services`, async ({
    page,
  }) => {
    await loginWithMocks(page, false, "nadia@example.test", undefined, role);
    await navigate(page, "Layanan pribadi");
    await expect(
      page.getByRole("heading", { name: "Layanan pribadi", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Belum ada slip gaji pribadi", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ajukan koreksi", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Password saat ini", { exact: true }),
    ).toBeVisible();
    if (role !== "ADMIN_HR")
      await expect(
        page
          .locator('[data-sidebar="menu-button"]')
          .getByText("Kebijakan HR", { exact: true }),
      ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  });
}

test("manager can create and explicitly cancel own pending leave", async ({
  page,
}) => {
  await loginWithMocks(page, false, "nadia@example.test", undefined, "MANAGER");
  let created = false,
    cancelled = false,
    cancelCount = 0;
  const leave = {
    id: "a0000000-0000-4000-8000-000000000009",
    employeeId: member.id,
    type: "ANNUAL",
    startDate: "2099-01-05",
    endDate: "2099-01-05",
    workingDays: 1,
    reason: "Keperluan demo",
    status: "PENDING",
    canDecide: false,
    version: 1,
  };
  await page.route("**/api/v1/leave-requests**", async (route) => {
    if (route.request().url().includes("/cancel")) {
      expect(route.request().postDataJSON()).toEqual({ expectedVersion: 1 });
      cancelled = true;
      cancelCount++;
    } else if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({
        type: "ANNUAL",
        startDate: "2099-01-05",
        endDate: "2099-01-05",
        reason: "Keperluan demo",
      });
      created = true;
    }
    const data =
      route.request().method() === "GET"
        ? created
          ? [{ ...leave, status: cancelled ? "CANCELLED" : "PENDING" }]
          : []
        : leave;
    await route.fulfill({ json: { data, meta: { totalPages: 1 } } });
  });
  await navigate(page, "Pengajuan cuti");
  await page.getByRole("button", { name: "Ajukan cuti", exact: true }).click();
  await page.getByLabel("Tanggal mulai", { exact: true }).fill("2099-01-05");
  await page.getByLabel("Tanggal selesai", { exact: true }).fill("2099-01-05");
  await page.getByLabel("Alasan", { exact: true }).fill("Keperluan demo");
  await page
    .getByRole("button", { name: "Kirim pengajuan", exact: true })
    .click();
  const row = page.getByRole("row").filter({ hasText: "Keperluan demo" });
  await expect(
    row.getByRole("button", { name: "Setujui", exact: true }),
  ).toHaveCount(0);
  await row
    .getByRole("button", { name: "Batalkan pengajuan", exact: true })
    .click();
  expect(cancelCount).toBe(0);
  await page
    .getByRole("button", { name: "Ya, batalkan pengajuan", exact: true })
    .click();
  await expect(row.getByText("Dibatalkan", { exact: true })).toBeVisible();
  expect(cancelCount).toBe(1);
});

test("HR fallback approval requires confirmation and shows actual reviewer", async ({
  page,
}) => {
  await loginWithMocks(page);
  let decided = false;
  await page.route("**/api/v1/leave-requests**", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({
        decision: "APPROVED",
        expectedVersion: 1,
      });
      decided = true;
    }
    const row = {
      id: "a0000000-0000-4000-8000-000000000009",
      employeeId: member.id,
      type: "ANNUAL",
      startDate: "2099-01-05",
      endDate: "2099-01-05",
      workingDays: 1,
      reason: "Cuti manager",
      status: decided ? "APPROVED" : "PENDING",
      canDecide: !decided,
      version: 1,
      decidedByName: decided ? "Reviewer HR demo" : null,
    };
    await route.fulfill({
      json: {
        data: route.request().method() === "GET" ? [row] : row,
        meta: { totalPages: 1 },
      },
    });
  });
  await navigate(page, "Pengajuan cuti");
  await page
    .getByRole("row")
    .filter({ hasText: "Cuti manager" })
    .getByRole("button", { name: "Setujui", exact: true })
    .click();
  expect(decided).toBe(false);
  await page
    .getByRole("button", { name: "Ya, setujui pengajuan", exact: true })
    .click();
  await expect(page.getByText(/Reviewer HR demo/)).toBeVisible();
  expect(decided).toBe(true);
});

test("attendance uses seconds-aware server status and disables holiday checkin", async ({
  page,
}) => {
  await loginWithMocks(page);
  await page.route("**/api/v1/hr-policy", (route) =>
    route.fulfill({
      json: {
        data: {
          workStart: "08:00",
          workEnd: "17:00",
          workingDays: [],
          holidayDates: [],
          defaultEntitlement: 12,
          sickBackdateDays: 7,
          version: 1,
        },
        meta: {},
      },
    }),
  );
  await page.route("**/api/v1/attendance?**", (route) => {
    const day = new URL(route.request().url()).searchParams.get("date");
    return route.fulfill({
      json: {
        data: [
          {
            id: "a",
            employeeId: member.id,
            workDate: day,
            checkInAt: `${day}T01:00:30Z`,
            checkOutAt: null,
            status: "LATE",
            version: 1,
          },
        ],
        meta: { totalPages: 1 },
      },
    });
  });
  // Force policy reload through a new signed session; do not mutate production settings.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Notifikasi", exact: true }),
  ).toBeVisible();
  await navigate(page, "Absensi");
  await expect(
    page.getByRole("button", { name: "Hari libur", exact: true }),
  ).toBeDisabled();
  const row = page.getByRole("row").filter({ hasText: "Dimas Saputra" });
  await expect(row.getByText("08:00", { exact: true })).toBeVisible();
  await expect(row.getByText("Terlambat", { exact: true })).toBeVisible();
});

test("notifications persist a read action and navigate to the related service", async ({
  page,
}) => {
  await loginWithMocks(page);
  let read = false;
  await page.route("**/api/v1/notifications", async (route) => {
    if (route.request().method() === "PATCH") {
      expect(route.request().postDataJSON()).toEqual({
        ids: ["payroll:own-item"],
      });
      read = true;
    }
    await route.fulfill({
      json: {
        data: [
          {
            id: "payroll:own-item",
            title: "Slip gaji tersedia",
            message: "Oktober 2026",
            at: "2026-10-10T02:00:00Z",
            view: "selfservice",
            read,
          },
        ],
        meta: {},
      },
    });
  });
  await page.getByRole("button", { name: "Notifikasi", exact: true }).click();
  await page.getByRole("button", { name: /Slip gaji tersedia/ }).click();
  await expect(
    page.getByRole("heading", { name: "Layanan pribadi", exact: true }),
  ).toBeVisible();
  expect(read).toBe(true);
});

test("HR policy and audit screens provide real API loading and retry", async ({
  page,
}) => {
  await loginWithMocks(page);
  await navigate(page, "Kebijakan HR");
  await expect(page.getByLabel("Jam mulai", { exact: true })).toHaveValue(
    "08:00",
  );
  await expect(
    page.getByRole("button", { name: "Simpan kebijakan", exact: true }),
  ).toBeVisible();
  await page.route("**/api/v1/audit-log?**", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: { code: "SERVICE_UNAVAILABLE", message: "Audit tidak tersedia" },
        meta: {},
      },
    }),
  );
  await navigate(page, "Riwayat aktivitas");
  await expect(
    page.getByRole("alert").filter({ hasText: "Audit tidak tersedia" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Coba kembali", exact: true }),
  ).toBeVisible();
});

test("manager composes weighted KPI, saves draft and finalizes with explicit review replacement", async ({
  page,
}) => {
  await loginWithMocks(page, false, "dimas@example.test", undefined, "MANAGER");
  const target = {
    ...member,
    id: "e0000000-0000-4000-8000-000000000002",
    fullName: "Jonatan Arya Santosa",
  };
  await page.route("**/api/v1/employees?**", (route) =>
    route.fulfill({
      json: {
        data: [summary(member), summary(target)],
        meta: { totalPages: 1 },
      },
    }),
  );
  let row: KpiDto | null = null;
  let publishes = 0;
  await page.route("**/api/v1/kpis**", async (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname.endsWith("/targets")) {
      await route.fulfill({
        json: {
          data: [{ id: target.id, name: target.fullName }],
          meta: { totalPages: 1 },
        },
      });
      return;
    }
    if (new URL(request.url()).pathname.endsWith("/share-goals")) {
      expect(request.postDataJSON()).toEqual({ expectedVersion: 1 });
      row = { ...row!, goalsSharedAt: "2026-10-11T05:00:00Z", version: 2 };
      await route.fulfill({ json: { data: row, meta: {} } });
      return;
    }
    if (request.method() === "PUT") {
      const body = request.postDataJSON();
      expect(body.employeeId).toBe(target.id);
      expect(body.expectedVersion).toBeNull();
      expect(body.indicators.map((i: { actual: number }) => i.actual)).toEqual([
        80, 90, 100,
      ]);
      row = {
        id: "a0000000-0000-4000-8000-000000000001",
        employeeId: target.id,
        employeeName: target.fullName,
        period: body.period,
        indicators: body.indicators,
        notes: body.notes,
        status: "DRAFT",
        score: null,
        version: 1,
        publishedAt: null,
      };
      await route.fulfill({ json: { data: row, meta: {} } });
      return;
    }
    if (request.method() === "POST") {
      expect(request.postDataJSON()).toEqual({
        expectedVersion: 2,
        expectedReviewVersion: 3,
      });
      publishes++;
      if (publishes === 1) {
        await route.fulfill({
          status: 409,
          json: {
            error: {
              code: "VERSION_CONFLICT",
              message: "Data telah berubah, muat ulang",
            },
            meta: {},
          },
        });
        return;
      }
      row = {
        ...row!,
        status: "PUBLISHED",
        version: 2,
        score: kpiScore(row!.indicators),
        publishedAt: "2026-10-11T06:00:00Z",
      };
      await route.fulfill({ json: { data: row, meta: {} } });
      return;
    }
    await route.fulfill({
      json: { data: row ? [row] : [], meta: { totalPages: 1 } },
    });
  });
  await page.route("**/api/v1/performance-reviews?**", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "review1",
            employeeId: target.id,
            period: "2026-10",
            score: row?.score ?? 50,
            notes: "Review",
            version: 3,
            assessedAt: "2026-10-01T00:00:00Z",
            kpiId: row?.status === "PUBLISHED" ? row.id : null,
          },
        ],
        meta: { totalPages: 1 },
      },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Notifikasi", exact: true }),
  ).toBeVisible();
  await navigate(page, "KPI");
  await page.getByRole("button", { name: "Susun KPI", exact: true }).click();
  await expect(page.getByLabel("Karyawan KPI", { exact: true })).toHaveValue(
    target.id,
  );
  await page.getByLabel("Bobot 1", { exact: true }).fill("49");
  await expect(
    page.getByRole("button", { name: "Simpan draf KPI", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Bobot 1", { exact: true }).fill("50");
  for (const [i, actual] of [
    [1, 80],
    [2, 90],
    [3, 100],
  ]) {
    await page
      .getByLabel(`Realisasi ${i}`, { exact: true })
      .fill(String(actual));
    await page
      .getByLabel(`Bukti realisasi ${i}`, { exact: true })
      .fill("Data uji: daftar tugas bulan Oktober");
  }
  await expect(
    page.getByText("Pratinjau nilai: 87", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("kpi-editor.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Simpan draf KPI", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Tutup editor", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Bagikan target KPI", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ya, bagikan target KPI", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Terbitkan KPI", exact: true })
    .click();
  await expect(page.getByText(/Penilaian lama 50\/100/)).toBeVisible();
  await page
    .getByRole("button", { name: "Ya, terbitkan KPI final", exact: true })
    .click();
  await expect(
    page.getByText("Data telah berubah, muat ulang", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Terbitkan KPI", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ya, terbitkan KPI final", exact: true })
    .click();
  await expect(page.locator(".kpi-badge.final")).toHaveText("Final");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.screenshot({
    path: test.info().outputPath("kpi-final.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Edit draf KPI", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await navigate(page, "Penilaian kinerja");
  await expect(
    page.getByRole("button", { name: "Lihat KPI final", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Beri penilaian", exact: true }),
  ).toHaveCount(0);
});

for (const role of ["EMPLOYEE", "ADMIN_HR"] as const)
  test(`${role} reads KPI details without editing controls`, async ({
    page,
  }) => {
    await loginWithMocks(
      page,
      false,
      role === "EMPLOYEE" ? "dimas@example.test" : "nadia@example.test",
      undefined,
      role,
    );
    await page.route("**/api/v1/kpis?**", (route) =>
      route.fulfill({
        json: {
          data: [
            {
              id: "kpi1",
              employeeId: member.id,
              employeeName: member.fullName,
              period: "2026-10",
              indicators: kpiTemplate().map((i) => ({ ...i, actual: 100 })),
              notes: "Hasil evaluasi demo",
              status: "PUBLISHED",
              score: 100,
              version: 2,
              publishedAt: "2026-10-11T06:00:00Z",
            },
          ],
          meta: { totalPages: 1 },
        },
      }),
    );
    await navigate(page, "KPI");
    await expect(
      page.getByText("Hasil evaluasi demo", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Sangat baik", { exact: true })).toBeVisible();
    const help = page.locator(".panel.kpi-help");
    await expect(help).toContainText("Memahami nilai KPI");
    await expect(help).toContainText("Nilai dihitung otomatis, maksimal 100.");
    await expect(help).toContainText(
      "selesai 8 dari target 10 tugas = capaian 80%",
    );
    await expect(help).toContainText("menyumbang 40 poin");
    await expect(help).toContainText(
      "KPI tidak otomatis mengubah gaji atau bonus.",
    );
    await expect(help).not.toContainText("÷");
    if (role === "EMPLOYEE")
      await expect(
        page.getByRole("button", { name: "Susun KPI", exact: true }),
      ).toHaveCount(0);
    else
      await expect(
        page.getByRole("button", { name: "Susun KPI", exact: true }),
      ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Edit draf KPI", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  });

test("employee reads shared targets before final without draft evaluation controls", async ({
  page,
}) => {
  await loginWithMocks(
    page,
    false,
    "dimas@example.test",
    undefined,
    "EMPLOYEE",
  );
  await page.route("**/api/v1/kpi-goals?**", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "safe-goals",
            employeeId: member.id,
            employeeName: member.fullName,
            period: "2026-10",
            sharedAt: "2026-10-11T05:00:00Z",
            indicators: kpiTemplate().map((item) => ({
              name: item.name,
              unit: item.unit,
              direction: item.direction,
              target: item.target,
              weight: item.weight,
              measurement: item.measurement,
            })),
          },
        ],
        meta: { totalPages: 1 },
      },
    }),
  );
  await navigate(page, "KPI");
  await expect(
    page.getByText("Target dibagikan", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Target periode 2026-10. Penilaian belum final.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".kpi-card")).not.toContainText("Realisasi");
  await expect(page.locator(".kpi-card .score")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Susun KPI", exact: true }),
  ).toHaveCount(0);
});

test("HR composes KPI only for server-authorized Manager targets", async ({
  page,
}) => {
  await loginWithMocks(page);
  await page.route("**/api/v1/kpis/targets?**", (route) =>
    route.fulfill({
      json: {
        data: [{ id: member.id, name: "Manager UAT" }],
        meta: { totalPages: 1 },
      },
    }),
  );
  await navigate(page, "KPI");
  await page.getByRole("button", { name: "Susun KPI", exact: true }).click();
  await expect(
    page.getByLabel("Karyawan KPI", { exact: true }).locator("option"),
  ).toHaveCount(1);
  await expect(page.getByLabel("Karyawan KPI", { exact: true })).toHaveValue(
    member.id,
  );
  await expect(
    page.getByLabel("Cara mengukur 1", { exact: true }),
  ).toContainText("Jumlah tugas selesai");
});

test("KPI load failure is explicit and retryable", async ({ page }) => {
  await loginWithMocks(page);
  let failed = true;
  await page.route("**/api/v1/kpis?**", (route) =>
    route.fulfill(
      failed
        ? {
            status: 503,
            json: {
              error: {
                code: "SERVICE_UNAVAILABLE",
                message: "KPI tidak tersedia",
              },
              meta: {},
            },
          }
        : { json: { data: [], meta: { totalPages: 1 } } },
    ),
  );
  await navigate(page, "KPI");
  await expect(
    page.getByRole("alert").filter({ hasText: "KPI tidak tersedia" }),
  ).toBeVisible();
  failed = false;
  await page.getByRole("button", { name: "Coba kembali", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Belum ada KPI pada periode ini",
      exact: true,
    }),
  ).toBeVisible();
});
