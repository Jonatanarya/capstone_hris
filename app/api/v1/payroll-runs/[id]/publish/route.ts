import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";

export async function POST(
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

    const body = (await readJson(request)) as { expectedVersion?: number };
    const expectedVersion = Number(body.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw api.validation({ expectedVersion: ["Wajib integer >= 1"] });
    }

    const { data, error } = await supabase.rpc("publish_payroll_run", {
      p_run_id: id,
      p_expected_version: expectedVersion,
    });
    if (error) throw toApiError(error);
    return ok({
      id: data.id,
      period: data.period,
      status: data.status,
      publishedAt: data.published_at,
      version: data.version,
    });
  });
}
