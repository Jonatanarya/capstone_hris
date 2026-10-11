import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { toApiError } from "@/lib/api/errors";
import { isUuid } from "@/lib/api/dto";
import { workflowBody, workflowVersion } from "@/lib/api/workflows";
import { kpiDto, type KpiRow } from "@/lib/api/kpi";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const db = await createSupabaseServerClient();
    const actor = await getActor(db);
    assertActive(actor);
    requireRole(actor, "MANAGER", "ADMIN_HR");
    const { id } = await context.params;
    if (!isUuid(id)) throw api.notFound();
    const body = (await readJson(request)) as Record<string, unknown>;
    workflowBody(body, ["expectedVersion"]);
    const { data, error } = await db.rpc("share_kpi_goals", {
      p_id: id,
      p_expected_version: workflowVersion(body.expectedVersion),
    });
    if (error) throw toApiError(error);
    return ok(kpiDto(data as KpiRow));
  });
}
