import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handle, ok } from "@/lib/api/http";

export async function POST() {
  return handle(async () => {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return ok({ signedOut: true });
  });
}