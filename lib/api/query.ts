import { api } from "./http";

export type Pagination = {
  url: URL;
  page: number;
  pageSize: number;
  q: string;
  from: number;
  to: number;
};

/** Parse page/pageSize/q sesuai kontrak (pageSize maksimum 100). */
export function pagination(request: Request): Pagination {
  const url = new URL(request.url);
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const sizeRaw = Number(url.searchParams.get("pageSize") ?? "20");
  let pageSize = Number.isFinite(sizeRaw) && sizeRaw >= 1 ? Math.floor(sizeRaw) : 20;
  if (pageSize > 100) pageSize = 100;
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const from = (page - 1) * pageSize;
  return { url, page, pageSize, q, from, to: from + pageSize - 1 };
}

export function requireEnum<T extends string>(
  value: string | null,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === null) return undefined;
  if (!allowed.includes(value as T)) {
    throw api.validation({ [field]: ["Nilai tidak dikenal"] });
  }
  return value as T;
}