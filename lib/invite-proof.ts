/** Only use with signature-verified claims and an Auth-server-verified user. */
export function hasFreshInviteProof(
  claims: Record<string, unknown>,
  user: { id: string; invited_at?: string; email_confirmed_at?: string },
  status: string | undefined,
  now = Date.now(),
) {
  if (
    claims.sub !== user.id ||
    !user.invited_at ||
    !user.email_confirmed_at ||
    status !== "INVITED" ||
    !Array.isArray(claims.amr)
  )
    return false;
  return claims.amr.some((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const method = entry as { method?: unknown; timestamp?: unknown };
    // Supabase's default /verify invite redirect issues an OTP session.
    return (
      (method.method === "otp" || method.method === "invite") &&
      typeof method.timestamp === "number" &&
      method.timestamp * 1000 <= now + 30000 &&
      method.timestamp * 1000 >= now - 900000
    );
  });
}
