import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, created, handle, listOk, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { masterDto } from "@/lib/api/dto";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);

    const { page, pageSize, q, from, to } = pagination(request);
    let query = supabase
      .from("positions")
      .select("id, name, status, version", { count: "exact" })
      .order("name", { ascending: true })
      .range(from, to);
    if (q) query = query.ilike("name", `%${q.replace(/[,()%]/g, " ")}%`);

    const { data, error, count } = await query;
    if (error) throw toApiError(error);
    return listOk((data ?? []).map(masterDto), page, pageSize, count ?? 0);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "ADMIN_HR") throw api.forbidden();

    const body = (await readJson(request)) as { name?: string };
    const name = String(body.name ?? "").trim();
    if (!name || name.length > 150)
      throw api.validation({ name: ["1–150 karakter"] });

    const { data, error } = await supabase.rpc("write_master", {
      p_kind: "positions",
      p_id: null,
      p_name: name,
      p_expected_version: null,
    });
    if (error) throw toApiError(error);
    return created(masterDto(data));
  });
}
