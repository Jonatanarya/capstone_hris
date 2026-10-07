import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}
const read = (file) => readFileSync(file, "utf8");
const regression = read("tests/database/hardening.sql");
const ciDatabase = process.env.HRIS_TEST_DATABASE_URL;
let output;
if (ciDatabase) {
  if (
    !["localhost", "127.0.0.1"].includes(new URL(ciDatabase).hostname) ||
    !process.env.CI
  )
    throw new Error(
      "Database bootstrap requires an isolated localhost CI service.",
    );
  const migrations = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort();
  execFileSync("psql", [ciDatabase, "-X", "-v", "ON_ERROR_STOP=1"], {
    input:
      read("tests/database/bootstrap.sql") +
      migrations.map((file) => read("supabase/migrations/" + file)).join("\n") +
      read("tests/database/fixtures.sql"),
    stdio: ["pipe", "ignore", "pipe"],
  });
  try {
    execFileSync("psql", [ciDatabase, "-X", "-v", "ON_ERROR_STOP=1"], {
      input: "begin;\n" + regression,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    output = String(error.stderr);
  }
} else {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!url || !token)
    throw new Error(
      "Provide isolated CI database or Supabase URL + private Management token for rollback-only tests.",
    );
  const ref = new URL(url).hostname.split(".")[0];
  const pending = process.argv.includes("--with-pending")
    ? ["0007_business_hardening.sql", "0008_account_lifecycle.sql"]
        .map((f) => read("supabase/migrations/" + f))
        .join("\n")
    : "";
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "begin;\n" + pending + "\n" + regression }),
      signal: AbortSignal.timeout(60000),
    },
  );
  output = JSON.stringify(await response.json());
}
const marker = /HRIS_REGRESSION_PASS:(\d+)/.exec(output ?? "");
if (!marker) {
  console.error(
    "Database regression did not finish:",
    (output ?? "No result").slice(0, 1800),
  );
  process.exitCode = 1;
} else
  console.log(
    `PASS ${marker[1]} database regression assertions; all business/audit changes rolled back.`,
  );
