import { cookies } from "next/headers";
import { FLOW_COOKIE, readAuthFlow } from "@/lib/auth-flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { toApiError } from "@/lib/api/errors";

export async function POST(request: Request) {
  return handle(async () => {
    const store = await cookies();
    const flow = readAuthFlow(store.get(FLOW_COOKIE)?.value);
    if (!flow)
      throw api.forbidden(
        "Tautan pemulihan/undangan kedaluwarsa. Minta tautan baru.",
      );
    const supabase = await createSupabaseServerClient();
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || data.user?.id !== flow.userId) throw api.unauthenticated();
    const body = await readJson(request);
    if (
      Object.keys(body).some((k) => k !== "password") ||
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      body.password.length > 128
    ) {
      throw api.validation({ password: ["Gunakan 8–128 karakter"] });
    }
    const { error } = await supabase.auth.updateUser({
      password: body.password,
    });
    if (error)
      throw api.validation({
        password: [
          "Kata sandi ditolak. Gunakan kata sandi baru yang lebih kuat.",
        ],
      });
    if (flow.type === "invite") {
      const { error: activationError } = await createSupabaseAdminClient().rpc(
        "activate_invited_account",
        { p_user: flow.userId },
      );
      if (activationError) throw toApiError(activationError);
    }
    store.delete(FLOW_COOKIE);
    await supabase.auth.signOut({ scope: "local" });
    return ok({ updated: true });
  });
}
