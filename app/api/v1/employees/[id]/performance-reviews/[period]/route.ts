import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";

/** Retired endpoint: one source of final scores, without erasing old reviews. */
export async function PUT() {
  return handle(async () => {
    const db = await createSupabaseServerClient();
    assertActive(await getActor(db));
    throw api.forbidden(
      "Penilaian manual dinonaktifkan. Admin HR menerbitkan hasil melalui KPI.",
    );
  });
}
