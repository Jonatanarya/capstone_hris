import { createSupabaseServerClient } from "@/lib/supabase/server";
import { created, handle, listOk, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { pagination } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";
import {
  workflowBody,
  workflowDate,
  workflowTime,
  workflowText,
} from "@/lib/api/workflows";

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    assertActive(await getActor(supabase));
    const { page, pageSize, from, to } = pagination(request);
    const { data, error, count } = await supabase
      .from("attendance_corrections")
      .select(
        "id,employee_id,work_date,requested_in,requested_out,reason,status,decision_note,version,employees(full_name)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
    if (error) throw toApiError(error);
    return listOk(data ?? [], page, pageSize, count ?? 0);
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    assertActive(await getActor(supabase));
    const body = (await readJson(request)) as Record<string, unknown>;
    workflowBody(body, ["workDate", "checkIn", "checkOut", "reason"]);
    const { data, error } = await supabase.rpc(
      "request_attendance_correction",
      {
        p_date: workflowDate(body.workDate),
        p_in: workflowTime(body.checkIn),
        p_out: body.checkOut ? workflowTime(body.checkOut) : null,
        p_reason: workflowText(body.reason),
      },
    );
    if (error) throw toApiError(error);
    return created(data);
  });
}
