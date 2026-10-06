import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";

/** Ganti kata sandi untuk identitas yang sudah terverifikasi (recovery/invite). */
export async function POST(request: Request) {
  return handle(async () => {
    const body = (await readJson(request)) as { password?: string };
    const password = String(body.password ?? "");
    if (password.length < 8) {
      throw api.validation({ password: ["Minimal 8 karakter"] });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw api.unauthenticated();

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw api.validation({ password: [error.message] });
    return ok({ updated: true });
  });
}