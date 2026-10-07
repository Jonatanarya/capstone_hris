import { api } from "./http";
import { toApiError } from "./errors";

/** Counted batches avoid Supabase's max-rows cap. Fail clearly above 10k,
 * rather than returning a successful but truncated export. */
export async function exportRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: unknown;
    count: number | null;
  }>,
) {
  const rows: T[] = [];
  for (let from = 0; from < 10000; from += 500) {
    const { data, error, count } = await fetchPage(from, from + 499);
    if (error) throw toApiError(error);
    if (count === null)
      throw api.serviceUnavailable("Jumlah baris laporan tidak tersedia");
    if (count > 10000)
      throw api.validation({
        export: ["Maksimum 10.000 baris; persempit filter laporan"],
      });
    rows.push(...(data ?? []));
    if (rows.length >= count) return rows;
    if (data && data.length !== 500)
      throw api.serviceUnavailable(
        "Batas halaman Data API berubah; ekspor dibatalkan agar tidak terpotong.",
      );
    if (!data?.length)
      throw api.serviceUnavailable("Data berubah saat ekspor. Coba ulangi.");
  }
  return rows;
}
