import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const u = data.user;
      // 講師プロフィールを作成/更新
      await createAdminClient().from("profiles").upsert({
        id: u.id,
        email: u.email!,
        name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? null,
        avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
      });
      // Vercel 等のプロキシ配下では x-forwarded-host を優先
      const forwardedHost = request.headers.get("x-forwarded-host");
      const base = forwardedHost ? `https://${forwardedHost}` : origin;
      return NextResponse.redirect(`${base}${next.startsWith("/") ? next : "/dashboard"}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
