import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";

type ReviewResult = {
  id: string;
  employee_id: string;
  period: string;
  score: number;
  notes: string;
  assessed_by: string;
  assessed_at: string;
  version: number;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; period: string }> },
) {
  return handle(async () => {
    const { id, period } = await params;
    if (!isUuid(id) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw api.notFound();

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "MANAGER") throw api.forbidden();

    const body = (await readJson(request)) as Record<string, unknown>;
    const allowed = new Set(["score", "notes", "expectedVersion"]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) throw api.validation({ [key]: ["Field tidak dikenal"] });
    }
    const score = Number(body.score);
    const notes = String(body.notes ?? "");
    const fieldErrors: Record<string, string[]> = {};
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      fieldErrors.score = ["Integer 0–100"];
    }
    if (notes.length > 2000) fieldErrors.notes = ["Maksimum 2000 karakter"];
    if (Object.keys(fieldErrors).length) throw api.validation(fieldErrors);

    const expectedVersion =
      body.expectedVersion === undefined ? null : Number(body.expectedVersion);

    const { data, error } = await supabase.rpc("upsert_performance_review", {
      p_employee_id: id,
      p_period: period,
      p_score: score,
      p_notes: notes,
      p_expected_version: expectedVersion,
    });
    if (error) throw toApiError(error);

    const r = data as ReviewResult;
    return ok({
      id: r.id,
      employeeId: r.employee_id,
      period: r.period,
      score: r.score,
      notes: r.notes,
      assessedBy: r.assessed_by,
      assessedAt: r.assessed_at,
      version: r.version,
    });
  });
}