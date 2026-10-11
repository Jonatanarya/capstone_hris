import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handle, ok } from "@/lib/api/http";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR");
    const { from, pageSize } = pagination(request);
    const { data, error } = await supabase.rpc("hr_audit_log", {
      p_offset: from,
      p_limit: pageSize,
    });
    if (error) throw toApiError(error);
    return ok(data ?? []);
  });
}
