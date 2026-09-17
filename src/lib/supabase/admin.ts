import { createClient } from "@supabase/supabase-js";

/** service_role でDBを操作するクライアント。サーバー側でのみ使用すること。 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
