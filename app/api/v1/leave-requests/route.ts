import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, created, handle, listOk, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { leaveDto, isUuid, type LeaveRow } from "@/lib/api/dto";
import { pagination, requireEnum } from "@/lib/api/query";
import { toApiError } from "@/lib/api/errors";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
const TYPES = ["ANNUAL", "PERMISSION", "SICK"] as const;

export async function GET(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);

    const { url, page, pageSize, from, to } = pagination(request);
    const status = requireEnum(
      url.searchParams.get("status"),
      STATUSES,
      "status",
    );
    const yearRaw = url.searchParams.get("year");
    const year = yearRaw ? Number(yearRaw) : undefined;
    if (yearRaw && (!Number.isInteger(year) || year! < 2000 || year! > 2100)) {
      throw api.invalidQuery("year tidak valid");
    }
    let employeeId = url.searchParams.get("employeeId");
    if (actor.role === "EMPLOYEE") employeeId = actor.employeeId;
    if (employeeId && !isUuid(employeeId))
      throw api.invalidQuery("employeeId tidak valid");

    let query = supabase
      .from("leave_requests")
      .select(
        "id, employee_id, type, start_date, end_date, working_days, reason, status, " +
          "submitted_at, decided_by, decided_at, rejection_reason, version",
        { count: "exact" },
      )
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);
    if (status) query = query.eq("status", status);
    if (year) {
      query = query
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`);
    }
    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data, error, count } = await query;
    if (error) throw toApiError(error);
    return listOk(
      (data as unknown as LeaveRow[]).map(leaveDto),
      page,
      pageSize,
      count ?? 0,
    );
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    if (actor.role !== "EMPLOYEE") throw api.forbidden();

    const body = (await readJson(request)) as Record<string, unknown>;
    const allowed = new Set(["type", "startDate", "endDate", "reason"]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key))
        throw api.validation({ [key]: ["Field tidak dikenal"] });
    }
    const type = requireEnum(String(body.type ?? ""), TYPES, "type");
    const start = String(body.startDate ?? "");
    const end = String(body.endDate ?? "");
    const reason = String(body.reason ?? "").trim();
    const fieldErrors: Record<string, string[]> = {};
    if (!type) fieldErrors.type = ["Wajib diisi"];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start))
      fieldErrors.startDate = ["Format YYYY-MM-DD"];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end))
      fieldErrors.endDate = ["Format YYYY-MM-DD"];
    if (!reason || reason.length > 2000)
      fieldErrors.reason = ["1–2000 karakter"];
    if (Object.keys(fieldErrors).length) throw api.validation(fieldErrors);

    const { data, error } = await supabase.rpc("create_leave_request", {
      p_type: type,
      p_start: start,
      p_end: end,
      p_reason: reason,
    });
    if (error) throw toApiError(error);
    return created(leaveDto(data as LeaveRow));
  });
}
