import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  isMaster: boolean;
};

export function isMasterEmail(email: string | null | undefined) {
  const master = (process.env.MASTER_EMAIL ?? "").toLowerCase();
  return !!email && !!master && email.toLowerCase() === master;
}

/** ログイン中の講師を返す。未ログインなら /login へ */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/login");
  return {
    id: user.id,
    email: user.email,
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email,
    isMaster: isMasterEmail(user.email),
  };
}
