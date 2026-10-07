import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { createAuthFlow, FLOW_COOKIE } from "@/lib/auth-flow";
import { hasFreshInviteProof } from "@/lib/invite-proof";

/** Bridge default implicit invitation email links into server-only cookies. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    if (
      Object.keys(body).some(
        (key) => !["access_token", "refresh_token"].includes(key),
      ) ||
      typeof body.access_token !== "string" ||
      body.access_token.length > 12000 ||
      typeof body.refresh_token !== "string" ||
      body.refresh_token.length > 4000 ||
      !body.access_token ||
      !body.refresh_token
    )
      throw api.invalidJson();
    const supabase = await createSupabaseServerClient();
    const proof = await supabase.auth.getClaims(body.access_token);
    if (proof.error || !proof.data)
      throw api.unauthenticated("Tautan tidak valid.");
    const verified = await supabase.auth.getUser(body.access_token);
    if (verified.error || !verified.data.user)
      throw api.unauthenticated("Tautan tidak valid.");
    // Elevated read is restricted to the cryptographically verified identity.
    const { data: profile, error } = await createSupabaseAdminClient()
      .from("user_profiles")
      .select("account_status")
      .eq("user_id", verified.data.user.id)
      .maybeSingle();
    if (error) throw api.serviceUnavailable();
    if (
      !hasFreshInviteProof(
        proof.data.claims,
        verified.data.user,
        profile?.account_status,
      )
    )
      throw api.forbidden("Undangan tidak valid atau kedaluwarsa. Hubungi HR.");
    // Validate that the refresh token belongs to the same verified invitation.
    const session = await supabase.auth.refreshSession({
      refresh_token: body.refresh_token,
    });
    if (session.error || session.data.user?.id !== verified.data.user.id) {
      await supabase.auth.signOut({ scope: "local" });
      throw api.unauthenticated("Sesi undangan tidak valid.");
    }
    (await cookies()).set(
      FLOW_COOKIE,
      createAuthFlow(verified.data.user.id, "invite"),
      {
        httpOnly: true,
        secure: process.env.VERCEL === "1",
        sameSite: "lax",
        path: "/",
        maxAge: 900,
      },
    );
    return ok({ confirmed: true });
  });
}
