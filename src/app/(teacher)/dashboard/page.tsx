import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/types";
import { daysUntil, fmtDate, fmtHours, fmtMonth, isExpired } from "@/lib/time";

type Row = {
  id: string;
  title: string;
  student_name: string;
  year_month: string;
  deadline: string;
  created_at: string;
  teacher_id: string;
  profiles: { email: string; name: string | null };
  responses: { submitted_at: string; updated_at: string }[] | { submitted_at: string; updated_at: string } | null;
  lessons: { start_min: number; end_min: number; status: string }[];
};

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : "";
  const student = typeof sp.student === "string" ? sp.student.trim() : "";
  const teacher = typeof sp.teacher === "string" ? sp.teacher : "";

  const admin = createAdminClient();
  let q = admin
    .from("schedules")
    .select("id, title, student_name, year_month, deadline, created_at, teacher_id, profiles!inner(email, name), responses(submitted_at, updated_at), lessons(start_min, end_min, status)")
    .order("year_month", { ascending: false })
    .order("created_at", { ascending: false });
  if (!user.isMaster) q = q.eq("teacher_id", user.id);
  else if (teacher) q = q.eq("teacher_id", teacher);
  if (month) q = q.eq("year_month", month);
  if (student) q = q.ilike("student_name", `%${student}%`);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];

  const months = Array.from(new Set(rows.map((r) => r.year_month))).sort().reverse();
  const teachers = user.isMaster
    ? ((await admin.from("profiles").select("id, email, name").order("name")).data ?? [])
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">日程調整一覧</h1>
        <Link href="/schedules/new" className="btn-accent">＋ 日程調整を作成</Link>
      </div>

      <form className="card grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="label">月</label>
          <select name="month" defaultValue={month} className="input">
            <option value="">すべて</option>
            {months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">生徒名</label>
          <input name="student" defaultValue={student} className="input" placeholder="部分一致" />
        </div>
        {user.isMaster && (
          <div>
            <label className="label">講師</label>
            <select name="teacher" defaultValue={teacher} className="input">
              <option value="">すべて</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name ?? t.email}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button className="btn-primary flex-1 px-3 py-2 whitespace-nowrap">絞り込む</button>
          <Link href="/dashboard" className="btn-ghost px-3 py-2 whitespace-nowrap">解除</Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="card py-10 text-center text-muted">
          まだ日程調整がありません。<br />「日程調整を作成」から始めましょう。
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const answered = !!one(r.responses);
            const expired = isExpired(r.deadline);
            const left = daysUntil(r.deadline);
            const total = r.lessons.filter((l) => l.status === "active").reduce((a, l) => a + (l.end_min - l.start_min), 0);
            const count = r.lessons.filter((l) => l.status === "active").length;
            return (
              <li key={r.id}>
                <Link href={`/schedules/${r.id}`} className="card block hover:border-teal">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-bold">{r.title}</div>
                      {user.isMaster && <div className="text-xs text-muted">講師：{r.profiles.name ?? r.profiles.email}</div>}
                    </div>
                    {answered ? (
                      <span className="shrink-0 rounded-full bg-green/20 px-3 py-1 text-xs font-bold text-green-800">回答済み</span>
                    ) : expired ? (
                      <span className="shrink-0 rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-600">期限切れ・未回答</span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-orange/20 px-3 py-1 text-xs font-bold text-orange-800">未回答</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>
                      回答期限 {fmtDate(r.deadline)}
                      {!answered && !expired && (
                        <span className={`ml-1 font-bold ${left <= 2 ? "text-red-500" : "text-orange-700"}`}>
                          {left === 0 ? "（今日まで）" : `（あと${left}日）`}
                        </span>
                      )}
                    </span>
                    {answered && <span>{count}コマ / 合計 <b className="text-ink">{fmtHours(total)}</b></span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
