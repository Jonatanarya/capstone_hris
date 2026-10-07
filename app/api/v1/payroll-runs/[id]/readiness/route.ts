import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { api, handle, ok } from "@/lib/api/http";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR");
    const { id } = await ctx.params;
    if (!isUuid(id)) throw api.notFound();
    const { data, error } = await supabase.rpc("payroll_run_readiness", {
      p_run_id: id,
    });
    if (error) throw toApiError(error);
    return ok(data);
  });
}
