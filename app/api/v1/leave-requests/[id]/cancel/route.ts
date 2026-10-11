import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { isUuid, leaveDto, type LeaveRow } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";
import { workflowBody, workflowVersion } from "@/lib/api/workflows";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    if (!isUuid(id)) throw api.notFound();
    const supabase = await createSupabaseServerClient();
    assertActive(await getActor(supabase));
    const body = (await readJson(request)) as Record<string, unknown>;
    workflowBody(body, ["expectedVersion"]);
    const { data, error } = await supabase.rpc("cancel_leave_request", {
      p_id: id,
      p_expected_version: workflowVersion(body.expectedVersion),
    });
    if (error) throw toApiError(error);
    return ok(leaveDto(data as LeaveRow));
  });
}
