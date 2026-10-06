/**
 * Supabase environment helpers. Nilai dibaca dari environment server.
 * Publishable/anon key aman untuk browser; service role HANYA di server.
 */
export type SupabaseEnv = { url: string; publishableKey: string };

export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di .env.local.",
    );
  }
  return env;
}

export function isSupabaseConfigured() {
  return readSupabaseEnv() !== null;
}