import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR");
    const { id } = await ctx.params;
    if (!isUuid(id)) throw api.notFound();
    const body = await readJson(request);
    if (
      Object.keys(body).some((key) => key !== "expectedVersion") ||
      !Number.isInteger(body.expectedVersion) ||
      Number(body.expectedVersion) < 1 ||
      Number(body.expectedVersion) > 2147483647
    )
      throw api.validation({ expectedVersion: ["Gunakan versi integer >= 1"] });
    const { data, error } = await supabase.rpc("sync_payroll_run", {
      p_run_id: id,
      p_expected_version: body.expectedVersion,
    });
    if (error) throw toApiError(error);
    return ok({
      id: data.id,
      period: data.period,
      status: data.status,
      publishedAt: data.published_at,
      publishedBy: data.published_by,
      version: data.version,
    });
  });
}
