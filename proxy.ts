import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { mutationAllowed } from "@/lib/api/request-security";
import { fail } from "@/lib/api/http";

/**
 * Refresh session Supabase dan propagasikan cookie. No-op bila Supabase belum
 * dikonfigurasi (mode demo frontend tetap berjalan tanpa backend).
 *
 * Dijalankan sebagai Proxy Next.js 16 (dulu bernama "middleware"). Nama file dan
 * fungsi sudah dimigrasikan sesuai konvensi `proxy`; perilakunya identik.
 */
export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/api/v1/") &&
    !mutationAllowed(request)
  ) {
    return fail(403, "FORBIDDEN", "Permintaan harus berasal dari aplikasi ini");
  }
  const env = readSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.VERCEL === "1",
      sameSite: "lax",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(cacheHeaders ?? {}))
          response.headers.set(name, value);
      },
    },
  });

  // Wajib: menyegarkan token sebelum render agar cookie selalu valid.
  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|ico)$).*)",
  ],
};
