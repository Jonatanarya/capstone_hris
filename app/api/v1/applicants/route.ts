import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { handle, listOk } from "@/lib/api/http";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";

export async function GET(request: Request) {
  return handle(async () => {
    const db = await createSupabaseServerClient();
    const actor = await getActor(db);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR", "MANAGER");
    const { from, to, page, pageSize } = pagination(request);
    const { data, error, count } = await db
      .from("demo_applicants")
      .select(
        "id,full_name,position_name,applied_on,aptitude_score,technical_score,interview_score,notes,is_dummy,version",
        { count: "exact" },
      )
      .order("full_name")
      .order("id")
      .range(from, to);
    if (error) throw toApiError(error);
    return listOk(data ?? [], page, pageSize, count ?? 0);
  });
}
