import { createSupabaseServerClient } from "@/lib/supabase/server";
import { api, handle, ok, readJson } from "@/lib/api/http";
import { assertActive, getActor } from "@/lib/api/actor";
import { buildMe } from "@/lib/api/me";
import { resolveLoginEmail } from "@/lib/api/login-identity";

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

    if (
      Object.keys(body).some(
        (key) => !["identifier", "email", "password"].includes(key),
      ) ||
      (body.identifier !== undefined && body.email !== undefined)
    )
      throw api.validation({ identifier: ["Gunakan satu NIM/NPM atau email"] });
    const rawIdentifier = body.identifier ?? body.email;
    const identifier =
      typeof rawIdentifier === "string" ? rawIdentifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fieldErrors: Record<string, string[]> = {};
    if (!identifier || identifier.length > 254)
      fieldErrors.identifier = [
        "NIM/NPM atau email wajib diisi (maksimal 254 karakter)",
      ];
    if (!password) fieldErrors.password = ["Kata sandi wajib diisi"];
    if (password.length > 128) fieldErrors.password = ["Maksimal 128 karakter"];
    if (Object.keys(fieldErrors).length) throw api.validation(fieldErrors);

    const email = await resolveLoginEmail(identifier);
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
