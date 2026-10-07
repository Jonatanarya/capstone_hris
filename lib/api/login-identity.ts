import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { api } from "./http";

/** Server-only mapping. Never expose a lookup endpoint or trust client roles. */
export async function resolveLoginEmail(identifier: string) {
  const value = identifier.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254)
    return value.toLowerCase();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,29}$/.test(value))
    throw api.invalidCredentials();
  const { data, error } = await createSupabaseAdminClient()
    .from("employees")
    .select("work_email")
    .eq("employee_no", value.toUpperCase())
    .maybeSingle<{ work_email: string }>();
  if (error)
    throw api.serviceUnavailable("Login belum dapat diproses. Coba lagi.");
  if (!data) throw api.invalidCredentials();
  return data.work_email;
}
