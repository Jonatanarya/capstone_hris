import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { handle, listOk } from "@/lib/api/http";
import { toApiError } from "@/lib/api/errors";
export async function GET() {
  return handle(async () => {
    const db = await createSupabaseServerClient();
    const actor = await getActor(db);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR", "MANAGER");
    const { data, error } = await db.rpc("kpi_assessment_targets");
    if (error) throw toApiError(error);
    return listOk(
      data ?? [],
      1,
      Math.max(1, data?.length ?? 0),
      data?.length ?? 0,
    );
  });
}
