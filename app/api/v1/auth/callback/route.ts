import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/supabase/env";

/** Callback flow Auth (bukan envelope JSON). Validasi code, redirect allowlist. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!readSupabaseEnv()) {
    return NextResponse.redirect(new URL("/?error=backend_not_configured", url.origin));
  }

  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") ?? "/";
  const next = nextRaw.startsWith("/") ? nextRaw : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/?error=exchange_failed", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}