import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor, requireRole } from "@/lib/api/actor";
import { toApiError } from "@/lib/api/errors";
import {
  policyDto,
  workflowBody,
  workflowDate,
  workflowTime,
  workflowVersion,
  type PolicyRow,
} from "@/lib/api/workflows";

export async function GET() {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    assertActive(await getActor(supabase));
    const { data, error } = await supabase
      .from("hr_policy")
      .select(
        "work_start,work_end,working_days,holiday_dates,default_entitlement,sick_backdate_days,policy_version",
      )
      .eq("id", 1)
      .single<PolicyRow>();
    if (error) throw toApiError(error);
    return ok(policyDto(data));
  });
}
export async function PATCH(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    requireRole(actor, "ADMIN_HR");
    const body = (await readJson(request)) as Record<string, unknown>;
    workflowBody(body, [
      "workStart",
      "workEnd",
      "workingDays",
      "holidayDates",
      "defaultEntitlement",
      "sickBackdateDays",
      "expectedVersion",
    ]);
    if (
      !Array.isArray(body.workingDays) ||
      !body.workingDays.length ||
      body.workingDays.length > 7 ||
      body.workingDays.some(
        (d) => typeof d !== "number" || !Number.isInteger(d) || d < 1 || d > 7,
      ) ||
      new Set(body.workingDays).size !== body.workingDays.length ||
      !Array.isArray(body.holidayDates) ||
      body.holidayDates.length > 100 ||
      typeof body.defaultEntitlement !== "number" ||
      !Number.isInteger(body.defaultEntitlement) ||
      body.defaultEntitlement < 0 ||
      body.defaultEntitlement > 60 ||
      typeof body.sickBackdateDays !== "number" ||
      !Number.isInteger(body.sickBackdateDays) ||
      body.sickBackdateDays < 0 ||
      body.sickBackdateDays > 30
    )
      throw api.validation({ policy: ["Kebijakan tidak valid"] });
    const { data, error } = await supabase.rpc("update_hr_policy", {
      p_expected_version: workflowVersion(body.expectedVersion),
      p_start: workflowTime(body.workStart),
      p_end: workflowTime(body.workEnd),
      p_days: body.workingDays,
      p_entitlement: body.defaultEntitlement,
      p_holidays: body.holidayDates.map(workflowDate),
      p_sick_backdate: body.sickBackdateDays,
    });
    if (error) throw toApiError(error);
    return ok(policyDto(data as PolicyRow));
  });
}
