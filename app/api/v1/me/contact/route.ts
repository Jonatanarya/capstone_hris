import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { toApiError } from "@/lib/api/errors";

export async function PATCH(request: Request) {
  return handle(async () => {
    const body = (await readJson(request)) as Record<string, unknown>;
    const allowed = new Set(["phone", "address", "expectedVersion"]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) {
        throw api.validation({ [key]: ["Field tidak dikenal"] });
      }
    }

    const phone = String(body.phone ?? "").trim();
    const address = String(body.address ?? "").trim();
    const expectedVersion = Number(body.expectedVersion);
    const fieldErrors: Record<string, string[]> = {};
    if (phone.length < 8 || phone.length > 20) fieldErrors.phone = ["8–20 karakter"];
    if (!address || address.length > 2000) fieldErrors.address = ["1–2000 karakter"];
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      fieldErrors.expectedVersion = ["Wajib integer >= 1"];
    }
    if (Object.keys(fieldErrors).length) throw api.validation(fieldErrors);

    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);

    const { data, error } = await supabase.rpc("update_own_contact", {
      p_expected_version: expectedVersion,
      p_phone: phone,
      p_address: address,
    });
    if (error) throw toApiError(error);

    return ok(data);
  });
}