import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handle, ok } from "@/lib/api/http";

export async function POST() {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    return ok({ signedOut: true });
  });
}
