// Explicit configuration change, never sends emails or changes user passwords.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}
const args = process.argv.slice(2);
const site = args[args.indexOf("--site-url") + 1];
if (
  !args.includes("--site-url") ||
  !site ||
  new URL(site).protocol !== "https:" ||
  new URL(site).pathname !== "/"
) {
  throw new Error(
    "Use --site-url https://your-production-host (HTTPS origin only).",
  );
}
const origin = new URL(site).origin;
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
  ".",
)[0];
const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = {
  Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
  "Content-Type": "application/json",
};
const response = await fetch(endpoint, { headers });
if (!response.ok)
  throw new Error("Cannot read Auth configuration: " + response.status);
const existing = await response.json();
function template(kind) {
  const old =
    existing[`mailer_templates_${kind}_content`] ||
    `<h2>PeopleSpace HRIS</h2><p><a href="{{ .ConfirmationURL }}">${kind === "invite" ? "Aktifkan akun" : "Atur kata sandi baru"}</a></p>`;
  const link = `{{ .SiteURL }}/api/v1/auth/callback?type=${kind}&amp;token_hash={{ .TokenHash }}`;
  if (!old.includes("{{ .ConfirmationURL }}") && !old.includes(link))
    throw new Error(
      "Custom template needs manual review; no configuration was changed.",
    );
  return old.replaceAll("{{ .ConfirmationURL }}", link);
}
const desired = {
  disable_signup: true,
  site_url: origin,
  uri_allow_list: ["invite", "recovery"]
    .map((kind) => `${origin}/api/v1/auth/callback?type=${kind}`)
    .join(","),
  password_min_length: Math.max(8, existing.password_min_length ?? 0),
  mailer_templates_invite_content: template("invite"),
  mailer_templates_recovery_content: template("recovery"),
};
console.log(
  "Auth plan:",
  JSON.stringify({
    project: ref,
    disable_signup: true,
    site_url: origin,
    password_min_length: desired.password_min_length,
    templateLinks:
      "server token_hash callback; existing email content preserved",
  }),
);
if (args.includes("--apply")) {
  const update = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify(desired),
  });
  if (!update.ok) throw new Error("Auth update failed: " + update.status);
  const verify = await fetch(endpoint, { headers });
  if (!verify.ok) throw new Error("Auth readback failed: " + verify.status);
  const actual = await verify.json();
  if (Object.entries(desired).some(([key, value]) => actual[key] !== value))
    throw new Error("Auth readback mismatch");
  console.log(
    "PASS Auth configuration updated and read back. No email/password operation performed.",
  );
} else console.log("Dry run only. Add --apply to persist this configuration.");
