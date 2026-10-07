import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handle, ok } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { buildMe } from "@/lib/api/me";

export async function GET() {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    return ok(await buildMe(supabase, actor));
  });
}
