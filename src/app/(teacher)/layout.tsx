import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export default async function TeacherLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
          <Link href="/dashboard"><Logo size={40} /></Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.name}{user.isMaster && "（マスター）"}</span>
            {user.isMaster && <span className="rounded-full bg-orange/20 px-2 py-0.5 text-xs font-bold text-orange-800 sm:hidden">マスター</span>}
            <form action="/auth/signout" method="post">
              <button className="text-muted underline">ログアウト</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">{children}</main>
    </>
  );
}
