import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { isUuid } from "@/lib/api/dto";
import { workflowBody, workflowVersion } from "@/lib/api/workflows";
import { toApiError } from "@/lib/api/errors";
import { validTestScore } from "@/lib/lecturer-revision";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const db = await createSupabaseServerClient();
    const actor = await getActor(db);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR");
    const { id } = await context.params;
    if (!isUuid(id)) throw api.notFound();
    const body = await readJson(request);
    workflowBody(body, [
      "aptitudeScore",
      "technicalScore",
      "interviewScore",
      "notes",
      "expectedVersion",
    ]);
    if (
      ![body.aptitudeScore, body.technicalScore, body.interviewScore].every(
        validTestScore,
      ) ||
      typeof body.notes !== "string" ||
      body.notes.length > 1000
    )
      throw api.validation({
        scores: [
          "Nilai harus bilangan bulat 0–100; catatan maksimal 1.000 karakter",
        ],
      });
    const { data, error } = await db.rpc("update_demo_applicant", {
      p_id: id,
      p_aptitude: body.aptitudeScore,
      p_technical: body.technicalScore,
      p_interview: body.interviewScore,
      p_notes: body.notes.trim(),
      p_expected_version: workflowVersion(body.expectedVersion),
    });
    if (error) throw toApiError(error);
    return ok(data);
  });
}
