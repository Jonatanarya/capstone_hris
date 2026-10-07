import { describe, it, expect, vi, afterEach } from "vitest";
import { hrApi, ApiClientError } from "../lib/api-client";

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

const envelope = <T>(data: T) => ({ data, meta: {} });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hrApi — pembentukan request", () => {
  it("login: POST same-origin dengan header dan body JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(envelope({ userId: "u1" })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(hrApi.login("budi@example.co.id", "rahasia")).resolves.toEqual(
      {
        userId: "u1",
      },
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/auth/login");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>)["X-HRIS-Request"]).toBe(
      "1",
    );
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      identifier: "budi@example.co.id",
      password: "rahasia",
    });
  });

  it("employees: menyusun query dan melewati nilai kosong/undefined", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(envelope<unknown[]>([])));
    vi.stubGlobal("fetch", fetchMock);

    await hrApi.employees({
      q: "budi",
      page: 2,
      departmentId: "",
      employmentStatus: undefined,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/employees?q=budi&page=2");
  });

  it("leaveBalance: menyertakan parameter tahun pada query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(envelope({})));
    vi.stubGlobal("fetch", fetchMock);

    await hrApi.leaveBalance(2026);

    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      "/api/v1/me/leave-balance?year=2026",
    );
  });

  it("inviteAccount: mengirim header Idempotency-Key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(envelope({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    await hrApi.inviteAccount("e1", "MANAGER", "key-123");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/accounts/invite");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "key-123",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      employeeId: "e1",
      role: "MANAGER",
    });
  });

  it("reportUrl: mengembalikan URL laporan tanpa memanggil fetch", () => {
    expect(
      hrApi.reportUrl("payroll", { period: "2026-09", page: undefined }),
    ).toBe("/api/v1/reports/payroll?period=2026-09");
  });
});

describe("hrApi — penanganan respons dan error", () => {
  it("fetches list pages using metadata rather than silently truncating", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ userId: "1" }],
          meta: { totalPages: 2, total: 2 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ userId: "2" }],
          meta: { totalPages: 2, total: 2 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(hrApi.accounts()).resolves.toEqual([
      { userId: "1" },
      { userId: "2" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("page=2");
  });
  it("does not pretend a too-large list is complete", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ data: [], meta: { total: 10001, totalPages: 101 } }),
        ),
    );
    await expect(hrApi.accounts()).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
  it("membuka envelope data pada respons sukses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(envelope([{ id: "x" }]))),
    );
    await expect(hrApi.accounts()).resolves.toEqual([{ id: "x" }]);
  });

  it("mengubah respons error menjadi ApiClientError lengkap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            data: null,
            meta: {},
            error: {
              code: "VALIDATION_ERROR",
              message: "Data tidak valid",
              fieldErrors: { email: ["wajib diisi"] },
            },
          },
          { ok: false, status: 422 },
        ),
      ),
    );

    const failure = hrApi.me();
    await expect(failure).rejects.toBeInstanceOf(ApiClientError);
    await expect(failure).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Data tidak valid",
      fieldErrors: { email: ["wajib diisi"] },
    });
  });

  it("tetap gagal bila envelope berisi error meski status ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: null,
          meta: {},
          error: { code: "FORBIDDEN", message: "Tidak diizinkan" },
        }),
      ),
    );

    await expect(hrApi.me()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Tidak diizinkan",
    });
  });

  it("menangani body JSON rusak sebagai INTERNAL_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("bukan JSON");
        },
      } as unknown as Response),
    );

    await expect(hrApi.me()).rejects.toMatchObject({
      status: 200,
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan pada server",
    });
  });
});
