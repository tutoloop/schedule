import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/site";
import { daysUntil, fmtDate, fmtRange, isExpired } from "@/lib/time";
import type { Availability, Lesson, LessonEdit, Schedule } from "@/lib/types";
import { CopyUrl } from "./CopyUrl";
import { LessonManager } from "./LessonManager";
import { DeleteScheduleButton } from "./DeleteScheduleButton";

export default async function SchedulePage({ params, searchParams }: PageProps<"/schedules/[id]">) {
  const { id } = await params;
  const { created } = await searchParams;
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: schedule } = await admin
    .from("schedules")
    .select("*, profiles!inner(email, name), responses(student_name, submitted_at, updated_at)")
    .eq("id", id)
    .single();
  if (!schedule) notFound();
  if (!user.isMaster && schedule.teacher_id !== user.id) notFound();

  const [{ data: avail }, { data: lessons }, { data: edits }] = await Promise.all([
    admin.from("availabilities").select("*").eq("schedule_id", id).order("date").order("start_min"),
    admin.from("lessons").select("*").eq("schedule_id", id).order("date").order("start_min"),
    admin.from("lesson_edits").select("*").eq("schedule_id", id).order("created_at", { ascending: false }),
  ]);

  const s = schedule as Schedule & { profiles: { email: string; name: string | null }; responses: { student_name: string; submitted_at: string; updated_at: string }[] };
  const response = s.responses[0];
  const expired = isExpired(s.deadline);
  const left = daysUntil(s.deadline);
  const url = `${await siteOrigin()}/s/${s.token}`;

  const availByDate = new Map<string, Availability[]>();
  for (const a of (avail ?? []) as Availability[]) availByDate.set(a.date, [...(availByDate.get(a.date) ?? []), a]);

  return (
    <div className="space-y-5">
      <Link href="/dashboard" className="text-sm text-muted">‹ 一覧へ戻る</Link>

      {created && (
        <div className="rounded-2xl border-2 border-green bg-green/10 p-4">
          <p className="font-bold text-green-900">日程調整を作成しました！</p>
          <p className="text-sm text-green-900/80">下のURLをコピーして生徒（保護者）に送ってください。</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{s.title}</h1>
            {user.isMaster && <p className="text-xs text-muted">講師：{s.profiles.name ?? s.profiles.email}（{s.profiles.email}）</p>}
          </div>
          {response ? (
            <span className="shrink-0 rounded-full bg-green/20 px-3 py-1 text-xs font-bold text-green-800">回答済み</span>
          ) : expired ? (
            <span className="shrink-0 rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-600">期限切れ・未回答</span>
          ) : (
            <span className="shrink-0 rounded-full bg-orange/20 px-3 py-1 text-xs font-bold text-orange-800">未回答</span>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">回答期限</dt>
          <dd>
            {fmtDate(s.deadline, true)}
            {!expired && <span className="ml-1 text-xs text-orange-700">（{left === 0 ? "今日まで" : `あと${left}日`}）</span>}
            {expired && <span className="ml-1 text-xs text-muted">（終了）</span>}
          </dd>
          {response && (
            <>
              <dt className="text-muted">回答者</dt>
              <dd>{response.student_name} さん<span className="ml-1 text-xs text-muted">（{new Date(response.updated_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}）</span></dd>
            </>
          )}
        </dl>
        <div className="mt-3">
          <label className="label">生徒用URL</label>
          <CopyUrl url={url} />
        </div>
      </div>

      <LessonManager
        scheduleId={s.id}
        yearMonth={s.year_month}
        lessons={(lessons ?? []) as Lesson[]}
        edits={(edits ?? []) as LessonEdit[]}
      />

      <details className="card">
        <summary className="cursor-pointer font-bold">講師の空き時間（設定内容）</summary>
        <ul className="mt-2 space-y-1 text-sm">
          {[...availByDate.entries()].map(([date, list]) => (
            <li key={date} className="flex gap-2">
              <span className="w-16 shrink-0 text-muted">{fmtDate(date)}</span>
              <span>{list.map((a) => fmtRange(a.start_min, a.end_min)).join("、")}</span>
            </li>
          ))}
        </ul>
      </details>

      <div className="text-right">
        <DeleteScheduleButton scheduleId={s.id} />
      </div>
    </div>
  );
}
