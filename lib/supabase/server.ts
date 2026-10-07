import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "./env";

/**
 * Supabase client untuk Server Components / Route Handlers / Server Actions.
 * Memakai cookie session (SSR). Query rutin memakai JWT pengguna sehingga RLS
 * tetap berlaku — jangan memakai ini untuk operasi admin elevated.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.VERCEL === "1",
      sameSite: "lax",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Dipanggil dari Server Component yang tidak boleh menulis cookie.
          // Refresh session tetap ditangani proxy.
        }
      },
    },
  });
}
