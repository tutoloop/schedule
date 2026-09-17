import Image from "next/image";
import { GoogleLoginButton } from "./GoogleLoginButton";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="card w-full max-w-sm text-center">
        <Image src="/logo.jpg" alt="TUTOLOOP" width={220} height={230} className="mx-auto" priority />
        <h1 className="mt-2 text-xl font-bold">日程調整システム</h1>
        <p className="mt-1 text-sm text-muted">講師の方はGoogleアカウントでログインしてください</p>
        <div className="mt-6">
          <GoogleLoginButton next={typeof next === "string" ? next : "/dashboard"} />
        </div>
      </div>
    </main>
  );
}
