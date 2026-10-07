import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { cookies } from "next/headers";
import { createAuthFlow, FLOW_COOKIE } from "@/lib/auth-flow";
import { safeNextPath } from "@/lib/api/request-security";

/** Callback flow Auth (bukan envelope JSON). Validasi code, redirect allowlist. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!readSupabaseEnv()) {
    return NextResponse.redirect(
      new URL("/?error=backend_not_configured", url.origin),
    );
  }

  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL("/?error=missing_code", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } =
    tokenHash && (type === "invite" || type === "recovery")
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : code
        ? await supabase.auth.exchangeCodeForSession(code)
        : { data: null, error: new Error("Invalid link") };
  if (error) {
    return NextResponse.redirect(
      new URL("/?error=exchange_failed", url.origin),
    );
  }
  if (data?.user && ((tokenHash && type === "invite") || type === "recovery")) {
    (await cookies()).set(
      FLOW_COOKIE,
      createAuthFlow(data.user.id, type as "invite" | "recovery"),
      {
        httpOnly: true,
        secure: process.env.VERCEL === "1",
        sameSite: "lax",
        path: "/",
        maxAge: 900,
      },
    );
    return NextResponse.redirect(new URL("/auth/recovery", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
