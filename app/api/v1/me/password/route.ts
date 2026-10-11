import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { workflowBody } from "@/lib/api/workflows";

/** Voluntary authenticated password change. Not the signed email recovery flow. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const actor = await getActor(supabase);
    assertActive(actor);
    const body = (await readJson(request)) as Record<string, unknown>;
    workflowBody(body, ["currentPassword", "newPassword"]);
    if (
      typeof body.currentPassword !== "string" ||
      !body.currentPassword ||
      body.currentPassword.length > 128 ||
      typeof body.newPassword !== "string" ||
      body.newPassword.length < 8 ||
      body.newPassword.length > 128 ||
      body.newPassword === body.currentPassword
    )
      throw api.validation({
        password: [
          "Password baru 8–128 karakter dan berbeda dari password saat ini",
        ],
      });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) throw api.unauthenticated();
    const { url, publishableKey } = requireSupabaseEnv();
    // No service-role reset, no identity from the request, no overwriting SSR cookies.
    const verifier = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const verified = await verifier.auth.signInWithPassword({
      email: user.email,
      password: body.currentPassword,
    });
    if (verified.error)
      throw api.validation({ currentPassword: ["Password saat ini salah"] });
    try {
      if (verified.data.user?.id !== actor.userId)
        throw api.forbidden("Identitas verifikasi tidak sesuai akun login");
      const { error } = await supabase.auth.updateUser({
        password: body.newPassword,
        current_password: body.currentPassword,
      });
      if (error)
        throw api.validation({
          password: [
            "Password tidak dapat diperbarui. Gunakan password yang lebih kuat atau masuk kembali.",
          ],
        });
      await supabase.auth.signOut({ scope: "local" });
      return ok({ changed: true, signInRequired: true });
    } finally {
      await verifier.auth.signOut({ scope: "local" });
    }
  });
}
