import { describe, expect, it } from "vitest";
import {
  attendanceFromDto,
  leaveFromDto,
  leaveStatusCode,
} from "@/lib/api-adapters";
import { attendanceLabel, isWorkingDate, offsetDate } from "@/lib/workflows";
import {
  workflowDate,
  workflowTime,
  workflowVersion,
  workflowBody,
  workflowText,
} from "@/lib/api/workflows";

const policy = {
  workStart: "08:00",
  workEnd: "17:00",
  workingDays: [1, 2, 3, 4, 5],
  holidayDates: ["2026-10-12"],
  defaultEntitlement: 12,
  sickBackdateDays: 7,
  version: 1,
};
describe("demo workflows", () => {
  it("uses server status even when seconds disappear from the display", () => {
    const row = attendanceFromDto({
      id: "a",
      employeeId: "e",
      workDate: "2026-10-09",
      checkInAt: "2026-10-09T01:00:30Z",
      checkOutAt: null,
      status: "LATE",
    });
    expect(row.checkIn).toBe("08:00");
    expect(attendanceLabel(row, "Aktif", undefined, true, true)).toBe(
      "Terlambat",
    );
    expect(
      attendanceLabel(
        { checkIn: "09:00", status: "PRESENT" },
        "Aktif",
        undefined,
        true,
        true,
      ),
    ).toBe("Hadir");
  });
  it("distinguishes holidays, inactive employees, and approved absences", () => {
    expect(isWorkingDate("2026-10-11", policy)).toBe(false);
    expect(isWorkingDate("2026-10-12", policy)).toBe(false);
    expect(isWorkingDate("2026-10-13", policy)).toBe(true);
    expect(isWorkingDate("2026-10-11", { ...policy, workingDays: [7] })).toBe(
      true,
    );
    expect(attendanceLabel(undefined, "Nonaktif", undefined, true, true)).toBe(
      "Nonaktif",
    );
    expect(attendanceLabel(undefined, "Aktif", "Sakit", true, true)).toBe(
      "Sakit",
    );
    expect(attendanceLabel(undefined, "Aktif", "Sakit", false, true)).toBe(
      "Hari libur",
    );
  });
  it("keeps stored working days and the actual approver name", () => {
    const row = leaveFromDto({
      id: "l",
      employeeId: "e",
      type: "ANNUAL",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      reason: "Test",
      status: "CANCELLED",
      workingDays: 1,
      canDecide: false,
      decidedByName: "Faisal",
    });
    expect(row.status).toBe("Dibatalkan");
    expect(row.workingDays).toBe(1);
    expect(row.approver).toBe("Faisal");
    expect(leaveStatusCode("Dibatalkan")).toBe("CANCELLED");
  });
  it("date offsets cross month/year boundaries safely", () => {
    expect(offsetDate("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("validates strict versions and unknown input fields", () => {
    for (const value of [null, "1", 0, 1.5, 2147483648])
      expect(() => workflowVersion(value)).toThrow();
    expect(workflowVersion(1)).toBe(1);
    expect(() => workflowBody({ employeeId: "another" }, ["reason"])).toThrow();
  });
  it("rejects impossible dates and invalid times", () => {
    for (const date of ["2026-02-30", "2026-13-01", "11/10/2026", undefined])
      expect(() => workflowDate(date)).toThrow();
    expect(workflowDate("2028-02-29")).toBe("2028-02-29");
    for (const time of ["24:00", "08:60", "8:00", null])
      expect(() => workflowTime(time)).toThrow();
    expect(workflowTime("08:00")).toBe("08:00");
    expect(() => workflowText(" ")).toThrow();
  });
});
