import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { isUuid } from "@/lib/api/dto";
import { toApiError } from "@/lib/api/errors";
import { PAYROLL_ITEM_SELECT, payrollItemDto, type PayrollItemRow } from "@/lib/api/payroll";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    if (!isUuid(id)) throw api.notFound();

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role === "MANAGER") throw api.forbidden();

    const { data, error } = await supabase
      .from("payroll_items")
      .select(PAYROLL_ITEM_SELECT)
      .eq("id", id)
      .maybeSingle<PayrollItemRow>();
    if (error) throw toApiError(error);
    if (!data) throw api.notFound();

    const { data: run } = await supabase
      .from("payroll_runs")
      .select("id, period, status, published_at")
      .eq("id", data.payroll_run_id)
      .maybeSingle<{ id: string; period: string; status: string; published_at: string | null }>();

    return ok({
      ...payrollItemDto(data),
      isDraftPreview: data.status !== "PUBLISHED",
      run: run
        ? { id: run.id, period: run.period, status: run.status, publishedAt: run.published_at }
        : null,
    });
  });
}