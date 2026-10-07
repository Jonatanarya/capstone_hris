import { describe, it, expect } from "vitest";
import {
  attendanceFromDto,
  backendRole,
  labelFromPeriod,
  leaveFromDto,
  leaveStatusCode,
  leaveStatusLabel,
  leaveTypeCode,
  leaveTypeLabel,
  periodFromLabel,
  personFromDto,
  personFromMe,
  uiRole,
  uiStatus,
  wibTime,
  type EmployeeSummaryDto,
} from "../lib/api-adapters";

const baseEmployee: EmployeeSummaryDto = {
  id: "3f1c6b1e-0000-0000-0000-000000000001",
  employeeNo: "EMP-0001",
  fullName: "Budi Santoso",
  workEmail: "budi@example.co.id",
  department: { id: "d1", name: "Engineering" },
  position: { id: "p1", name: "Backend Engineer" },
  employmentStatus: "ACTIVE",
  joinedOn: "2024-02-01",
  version: 3,
  contact: { phone: "0812", address: "Jakarta", version: 1 },
  compensation: { baseSalaryIdr: 9000000 },
};

describe("adapter status dan role", () => {
  it("memetakan employmentStatus ke label UI", () => {
    expect(uiStatus("ACTIVE")).toBe("Aktif");
    expect(uiStatus("INACTIVE")).toBe("Nonaktif");
    expect(uiStatus("APA_PUN")).toBe("Nonaktif");
  });

  it("memetakan role backend ⇄ label UI dua arah", () => {
    expect(uiRole("ADMIN_HR")).toBe("Admin HR");
    expect(uiRole("MANAGER")).toBe("Manager");
    expect(uiRole("EMPLOYEE")).toBe("Karyawan");
    expect(backendRole("Admin HR")).toBe("ADMIN_HR");
    expect(backendRole("Manager")).toBe("MANAGER");
    expect(backendRole("Karyawan")).toBe("EMPLOYEE");
  });
});

describe("adapter karyawan", () => {
  it("memetakan DTO lengkap ke UiPerson", () => {
    expect(personFromDto(baseEmployee)).toEqual({
      id: baseEmployee.id,
      name: "Budi Santoso",
      email: "budi@example.co.id",
      dept: "Engineering",
      position: "Backend Engineer",
      status: "Aktif",
      salary: 9000000,
      score: 0,
      employeeNo: "EMP-0001",
      phone: "0812",
      address: "Jakarta",
      joinDate: "2024-02-01",
    });
  });

  it("memberi default aman bila relasi opsional kosong", () => {
    const bare = personFromDto({
      ...baseEmployee,
      department: null,
      position: null,
      contact: null,
      compensation: null,
      employmentStatus: "INACTIVE",
    });
    expect(bare.dept).toBe("Tanpa departemen");
    expect(bare.position).toBe("");
    expect(bare.status).toBe("Nonaktif");
    expect(bare.salary).toBe(0);
    expect(bare.phone).toBe("");
    expect(bare.address).toBe("");
  });

  it("memetakan /me ke UiPerson lewat employee terkait", () => {
    const ui = personFromMe({
      userId: "u1",
      role: "MANAGER",
      accountStatus: "ACTIVE",
      employee: {
        id: baseEmployee.id,
        employeeNo: baseEmployee.employeeNo,
        fullName: baseEmployee.fullName,
        workEmail: baseEmployee.workEmail,
        department: baseEmployee.department,
        position: baseEmployee.position,
        employmentStatus: baseEmployee.employmentStatus,
        joinedOn: baseEmployee.joinedOn,
        version: baseEmployee.version,
        contact: baseEmployee.contact ?? null,
      },
    });
    expect(ui.id).toBe(baseEmployee.id);
    expect(ui.name).toBe("Budi Santoso");
    expect(ui.joinDate).toBe("2024-02-01");
  });
});

describe("adapter periode", () => {
  it("mengubah label bulan UI ke periode API", () => {
    expect(periodFromLabel("Januari 2026")).toBe("2026-01");
    expect(periodFromLabel("September 2026")).toBe("2026-09");
  });

  it("menolak label tidak dikenal atau tahun tidak valid", () => {
    expect(periodFromLabel("Bulan 2026")).toBe("");
    expect(periodFromLabel("September 26")).toBe("");
    expect(periodFromLabel("September")).toBe("");
  });

  it("mengubah periode API ke label bulan UI", () => {
    expect(labelFromPeriod("2026-09")).toBe("September 2026");
    expect(labelFromPeriod("2026-12")).toBe("Desember 2026");
  });

  it("mengembalikan input apa adanya bila bukan periode valid", () => {
    expect(labelFromPeriod("bogus")).toBe("bogus");
  });
});

describe("adapter cuti", () => {
  it("memetakan jenis dan status DTO ⇄ label UI", () => {
    expect(leaveTypeLabel("ANNUAL")).toBe("Cuti tahunan");
    expect(leaveTypeLabel("PERMISSION")).toBe("Izin");
    expect(leaveTypeLabel("SICK")).toBe("Sakit");
    expect(leaveTypeLabel("LAINNYA")).toBe("LAINNYA");
    expect(leaveTypeCode("Izin")).toBe("PERMISSION");
    expect(leaveTypeCode("tidak ada")).toBe("ANNUAL");

    expect(leaveStatusLabel("PENDING")).toBe("Menunggu");
    expect(leaveStatusLabel("APPROVED")).toBe("Disetujui");
    expect(leaveStatusLabel("REJECTED")).toBe("Ditolak");
    expect(leaveStatusCode("Disetujui")).toBe("APPROVED");
    expect(leaveStatusCode("tidak ada")).toBe("PENDING");
  });

  it("memetakan DTO cuti → UiLeave termasuk pemetaan approver", () => {
    const ui = leaveFromDto(
      {
        id: "l1",
        employeeId: "e1",
        type: "SICK",
        startDate: "2026-10-05",
        endDate: "2026-10-06",
        reason: "Demam",
        status: "APPROVED",
        submittedAt: "2026-10-04T02:15:00.000Z",
        decidedBy: "u9",
        decidedAt: "2026-10-04T09:00:00.000Z",
        rejectionReason: null,
        version: 2,
      },
      (userId) => (userId === "u9" ? "Admin HR" : undefined),
    );
    expect(ui).toMatchObject({
      id: "l1",
      employee: "e1",
      type: "Sakit",
      status: "Disetujui",
      submittedAt: "2026-10-04",
      approver: "Admin HR",
      decidedAt: "2026-10-04",
      version: 2,
    });
    expect(ui.rejectionReason).toBeUndefined();
  });

  it("menghilangkan approver bila pemeta tidak diberikan", () => {
    const ui = leaveFromDto({
      id: "l2",
      employeeId: "e2",
      type: "ANNUAL",
      startDate: "2026-10-05",
      endDate: "2026-10-05",
      reason: "Liburan",
      status: "PENDING",
    });
    expect(ui.approver).toBeUndefined();
    expect(ui.submittedAt).toBeUndefined();
    expect(ui.decidedAt).toBeUndefined();
  });
});

describe("adapter presensi dan waktu WIB", () => {
  it("mengubah timestamp UTC ke jam WIB (Asia/Jakarta)", () => {
    expect(wibTime("2026-10-05T01:30:00.000Z")).toBe("08:30");
    expect(wibTime(null)).toBe("");
  });

  it("memetakan DTO presensi ke bentuk UI", () => {
    expect(
      attendanceFromDto({
        id: "a1",
        employeeId: "e1",
        workDate: "2026-10-05",
        checkInAt: "2026-10-05T01:30:00.000Z",
        checkOutAt: null,
        status: "PRESENT",
      }),
    ).toEqual({
      employee: "e1",
      date: "2026-10-05",
      checkIn: "08:30",
      checkOut: "",
    });
  });
});
