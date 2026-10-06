import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { masterDto, isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    if (!isUuid(id)) throw api.notFound();

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "ADMIN_HR") throw api.forbidden();

    const body = (await readJson(request)) as { name?: string; expectedVersion?: number };
    const name = String(body.name ?? "").trim();
    const expectedVersion = Number(body.expectedVersion);
    if (!name || name.length > 150) throw api.validation({ name: ["1–150 karakter"] });
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw api.validation({ expectedVersion: ["Wajib integer >= 1"] });
    }

    const { data, error } = await supabase
      .from("positions")
      .update({ name })
      .eq("id", id)
      .eq("version", expectedVersion)
      .select("id, name, status, version")
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!data) throw api.conflict("VERSION_CONFLICT", "Data telah berubah, muat ulang");
    return ok(masterDto(data));
  });
}