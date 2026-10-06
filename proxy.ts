import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readSupabaseEnv } from "@/lib/supabase/env";

/**
 * Refresh session Supabase dan propagasikan cookie. No-op bila Supabase belum
 * dikonfigurasi (mode demo frontend tetap berjalan tanpa backend).
 *
 * Dijalankan sebagai Proxy Next.js 16 (dulu bernama "middleware"). Nama file dan
 * fungsi sudah dimigrasikan sesuai konvensi `proxy`; perilakunya identik.
 */
export async function proxy(request: NextRequest) {
  const env = readSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Wajib: menyegarkan token sebelum render agar cookie selalu valid.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|ico)$).*)",
  ],
};