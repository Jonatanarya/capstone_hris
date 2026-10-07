import { describe, expect, it, vi } from "vitest";
import { exportRows } from "../lib/api/export";
describe("complete counted exports", () => {
  it("collects beyond one Supabase page", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      id: String(index),
    }));
    const read = vi
      .fn()
      .mockResolvedValueOnce({ data: firstPage, count: 501, error: null })
      .mockResolvedValueOnce({
        data: [{ id: "last" }],
        count: 501,
        error: null,
      });
    expect(await exportRows(read)).toEqual([...firstPage, { id: "last" }]);
    expect(read).toHaveBeenLastCalledWith(500, 999);
  });
  it("fails clearly for oversized or missing-count responses", async () => {
    await expect(
      exportRows(async () => ({ data: [], count: 10001, error: null })),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      exportRows(async () => ({ data: [], count: null, error: null })),
    ).rejects.toMatchObject({ status: 503 });
  });
});
