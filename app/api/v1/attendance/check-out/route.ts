import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handle, ok } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { toApiError } from "@/lib/api/errors";

export async function POST() {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);

    const { data, error } = await supabase.rpc("attendance_check_out");
    if (error) throw toApiError(error);
    return ok(data);
  });
}