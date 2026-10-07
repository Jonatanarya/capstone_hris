/** Browser mutations require BOTH an exact same Origin and a non-simple header.
 * No CORS allow-origin/allow-headers are granted, so another website cannot send
 * this header with the user's cookies. This includes login and logout CSRF.
 */
export function mutationAllowed(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    origin === new URL(request.url).origin &&
    request.headers.get("x-hris-request") === "1" &&
    (!fetchSite || fetchSite === "same-origin")
  );
}

export function safeNextPath(value: string | null) {
  return value === "/auth/recovery" ? value : "/";
}
