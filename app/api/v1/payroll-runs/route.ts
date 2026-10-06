import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, created, handle, listOk, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";

type RunRow = {
  id: string;
  period: string;
  status: string;
  published_at: string | null;
  published_by: string | null;
  version: number;
};

function runDto(r: RunRow) {
  return {
    id: r.id,
    period: r.period,
    status: r.status,
    publishedAt: r.published_at,
    publishedBy: r.published_by,
    version: r.version,
  };
}

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role === "MANAGER") throw api.forbidden();

    const { url, page, pageSize, from, to } = pagination(request);
    const period = url.searchParams.get("period");
    if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw api.invalidQuery("period harus YYYY-MM");
    }

    let query = supabase
      .from("payroll_runs")
      .select("id, period, status, published_at, published_by, version", { count: "exact" })
      .order("period", { ascending: false })
      .range(from, to);
    if (period) query = query.eq("period", period);

    const { data, error, count } = await query;
    if (error) throw toApiError(error);
    return listOk((data as RunRow[]).map(runDto), page, pageSize, count ?? 0);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "ADMIN_HR") throw api.forbidden();

    const body = (await readJson(request)) as { period?: string };
    const period = String(body.period ?? "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw api.validation({ period: ["Format YYYY-MM"] });
    }

    const { data, error } = await supabase.rpc("create_payroll_run", { p_period: period });
    if (error) throw toApiError(error);
    return created(runDto(data as RunRow));
  });
}