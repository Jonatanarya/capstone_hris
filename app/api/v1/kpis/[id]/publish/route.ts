import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";
import { workflowBody, workflowVersion } from "@/lib/api/workflows";
import { kpiDto, type KpiRow } from "@/lib/api/kpi";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    requireRole(actor, "MANAGER");
    const { id } = await context.params;
    if (!isUuid(id)) throw api.notFound();
    const body = (await readJson(request)) as Record<string, unknown>;
    workflowBody(body, ["expectedVersion", "expectedReviewVersion"]);
    const { data, error } = await supabase.rpc("publish_kpi", {
      p_id: id,
      p_expected_version: workflowVersion(body.expectedVersion),
      p_expected_review_version:
        body.expectedReviewVersion === null
          ? null
          : workflowVersion(body.expectedReviewVersion),
    });
    if (error) throw toApiError(error);
    return ok(kpiDto(data as KpiRow));
  });
}
