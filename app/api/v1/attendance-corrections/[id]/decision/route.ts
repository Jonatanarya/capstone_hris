import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";
import {
  workflowBody,
  workflowVersion,
  workflowText,
} from "@/lib/api/workflows";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    if (!isUuid(id)) throw api.notFound();
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR");
    const body = (await readJson(request)) as Record<string, unknown>;
    workflowBody(body, ["decision", "note", "expectedVersion"]);
    if (body.decision !== "APPROVED" && body.decision !== "REJECTED")
      throw api.validation({ decision: ["Keputusan tidak valid"] });
    const { data, error } = await supabase.rpc("decide_attendance_correction", {
      p_id: id,
      p_decision: body.decision,
      p_note: workflowText(body.note),
      p_expected_version: workflowVersion(body.expectedVersion),
    });
    if (error) throw toApiError(error);
    return ok(data);
  });
}
