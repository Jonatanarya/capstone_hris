import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { buildMe } from "@/lib/api/me";

export async function POST(request: Request) {
  return handle(async () => {
    const body = (await readJson(request)) as Record<string, unknown>;

    // Login tidak boleh menentukan peran.
    if (
      body.role !== undefined ||
      body.userId !== undefined ||
      body.employeeId !== undefined
    ) {
      throw api.validation({
        role: ["Peran tidak boleh ditentukan saat login"],
      });
    }

    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const fieldErrors: Record<string, string[]> = {};
    if (!email) fieldErrors.email = ["Email wajib diisi"];
    if (!password) fieldErrors.password = ["Kata sandi wajib diisi"];
    if (Object.keys(fieldErrors).length) throw api.validation(fieldErrors);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw api.invalidCredentials();

    try {
      const actor = await getActor(supabase);
      assertActive(actor);
      return ok(await buildMe(supabase, actor));
    } catch (error) {
      await supabase.auth.signOut({ scope: "local" });
      throw error;
    }
  });
}
