import { createHmac, timingSafeEqual } from "node:crypto";

export const FLOW_COOKIE = "hris-auth-flow";
type Flow = { userId: string; type: "invite" | "recovery"; expires: number };
function secret() {
  const value =
    process.env.AUTH_FLOW_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Auth flow secret is unavailable");
  return value;
}
export function createAuthFlow(userId: string, type: Flow["type"]) {
  const payload = Buffer.from(
    JSON.stringify({ userId, type, expires: Date.now() + 900000 }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", secret()).update(payload).digest("base64url")
  );
}
export function readAuthFlow(value: string | undefined): Flow | null {
  if (!value || value.length > 1024) return null;
  try {
    const [payload, signature, extra] = value.split(".");
    if (!signature || extra) return null;
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const flow = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as Flow;
    return typeof flow.userId === "string" &&
      ["invite", "recovery"].includes(flow.type) &&
      typeof flow.expires === "number" &&
      flow.expires > Date.now() &&
      flow.expires <= Date.now() + 900000
      ? flow
      : null;
  } catch {
    return null;
  }
}
