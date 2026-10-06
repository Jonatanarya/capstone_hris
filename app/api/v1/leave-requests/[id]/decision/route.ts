import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { leaveDto, isUuid, type LeaveRow } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";

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
    if (actor.role !== "MANAGER") throw api.forbidden();

    const body = (await readJson(request)) as Record<string, unknown>;
    const allowed = new Set(["decision", "rejectionReason", "expectedVersion"]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) throw api.validation({ [key]: ["Field tidak dikenal"] });
    }
    const decision = String(body.decision ?? "");
    const expectedVersion = Number(body.expectedVersion);
    const fieldErrors: Record<string, string[]> = {};
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      fieldErrors.decision = ["APPROVED atau REJECTED"];
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      fieldErrors.expectedVersion = ["Wajib integer >= 1"];
    }
    if (Object.keys(fieldErrors).length) throw api.validation(fieldErrors);

    const { data, error } = await supabase.rpc("decide_leave_request", {
      p_request_id: id,
      p_decision: decision,
      p_rejection_reason: body.rejectionReason ?? null,
      p_expected_version: expectedVersion,
    });
    if (error) throw toApiError(error);
    return ok(leaveDto(data as LeaveRow));
  });
}