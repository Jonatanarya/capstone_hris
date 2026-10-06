import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handle, ok, readJson } from "@/lib/api/http";

export async function POST(request: Request) {
  return handle(async () => {
    const body = (await readJson(request)) as { email?: string };
    const email = String(body.email ?? "").trim();
    const supabase = await createSupabaseServerClient();

    // Pesan generik: jangan membocorkan apakah email terdaftar.
    if (email) {
      const origin = process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(request.url).origin
        : undefined;
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: origin ? `${origin}/auth/recovery` : undefined,
      });
    }
    return ok({ sent: true });
  });
}