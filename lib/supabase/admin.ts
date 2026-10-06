import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "./env";

/**
 * Kredensial elevated (service role). HANYA untuk operasi administratif yang
 * sudah memverifikasi pemohon HR. Klien ini melewati RLS — jangan dipakai untuk
 * query rutin dan jangan diekspor ke bundle browser (tidak boleh NEXT_PUBLIC).
 */
export function createSupabaseAdminClient() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diatur. Operasi admin memerlukan secret key server.",
    );
  }
  const { url } = requireSupabaseEnv();
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hasSupabaseAdminKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}