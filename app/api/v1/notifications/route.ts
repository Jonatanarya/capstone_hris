import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { toApiError } from "@/lib/api/errors";
import { workflowBody } from "@/lib/api/workflows";

export async function GET() {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    assertActive(await getActor(supabase));
    const { data, error } = await supabase.rpc("my_notifications");
    if (error) throw toApiError(error);
    return ok(data ?? []);
  });
}
export async function PATCH(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    assertActive(await getActor(supabase));
    const body = (await readJson(request)) as Record<string, unknown>;
    workflowBody(body, ["ids"]);
    if (
      !Array.isArray(body.ids) ||
      body.ids.length > 200 ||
      body.ids.some((id) => typeof id !== "string" || id.length > 100)
    )
      throw api.validation({ ids: ["ID notifikasi tidak valid"] });
    const { error } = await supabase.rpc("read_my_notifications", {
      p_ids: body.ids,
    });
    if (error) throw toApiError(error);
    return ok({ saved: true });
  });
}
