"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyRecipients, sendMail } from "@/lib/mail";
import { fmtDate, fmtHours, fmtRange, isExpired, LESSON_MIN, overlaps, STEP_MIN } from "@/lib/time";
import type { Availability, Slot } from "@/lib/types";
import { siteOrigin } from "@/lib/site";

/** 生徒が回答（初回・再編集どちらも）する */
export async function submitResponse(input: {
  token: string;
  studentName: string;
  lessons: Slot[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const studentName = input.studentName.trim();
  if (!studentName) return { ok: false, error: "お名前を入力してください" };
  if (input.lessons.length === 0) return { ok: false, error: "授業のコマを1つ以上選んでください" };

  const admin = createAdminClient();
  const { data: schedule } = await admin
    .from("schedules")
    .select("*, profiles!inner(email)")
    .eq("token", input.token)
    .single();
  if (!schedule) return { ok: false, error: "この日程調整は見つかりません" };
  if (isExpired(schedule.deadline))
    return { ok: false, error: "回答期限が切れたため変更できません。講師に直接連絡してください。" };

  const { data: avail } = await admin.from("availabilities").select("*").eq("schedule_id", schedule.id);
  const availabilities = (avail ?? []) as Availability[];

  // 入力検証：90分・30分刻み・空き時間内・自分のコマ同士が重ならない
  const sorted = [...input.lessons].sort((a, b) => a.date.localeCompare(b.date) || a.start_min - b.start_min);
  for (let i = 0; i < sorted.length; i++) {
    const l = sorted[i];
    if (l.end_min - l.start_min !== LESSON_MIN || l.start_min % STEP_MIN)
      return { ok: false, error: "コマの時間指定が不正です" };
    const inside = availabilities.some(
      (a) => a.date === l.date && a.start_min <= l.start_min && l.end_min <= a.end_min,
    );
    if (!inside) return { ok: false, error: `${fmtDate(l.date)} ${fmtRange(l.start_min, l.end_min)} は空き時間外です` };
    const prev = sorted[i - 1];
    if (prev && prev.date === l.date && overlaps(prev.start_min, prev.end_min, l.start_min, l.end_min))
      return { ok: false, error: `${fmtDate(l.date)} のコマ同士が重なっています` };
  }

  // 同じ講師の他の生徒のコマと重ならないか
  const { data: others } = await admin
    .from("lessons")
    .select("date, start_min, end_min, schedule_id, schedules!inner(teacher_id)")
    .eq("status", "active")
    .eq("schedules.teacher_id", schedule.teacher_id)
    .neq("schedule_id", schedule.id);
  for (const l of sorted) {
    const hit = (others ?? []).find(
      (o) => o.date === l.date && overlaps(o.start_min, o.end_min, l.start_min, l.end_min),
    );
    if (hit)
      return { ok: false, error: `${fmtDate(l.date)} ${fmtRange(l.start_min, l.end_min)} は他の生徒が予約済みです。別の時間を選んでください。` };
  }

  // 回答を保存（再編集時は以前のコマを置き換える）
  const { data: existing } = await admin.from("responses").select("id").eq("schedule_id", schedule.id).maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    await admin.from("responses").update({ student_name: studentName, updated_at: now }).eq("id", existing.id);
    await admin.from("lessons").delete().eq("schedule_id", schedule.id);
  } else {
    await admin.from("responses").insert({ schedule_id: schedule.id, student_name: studentName });
  }
  const { error } = await admin.from("lessons").insert(
    sorted.map((l) => ({
      schedule_id: schedule.id,
      date: l.date,
      start_min: l.start_min,
      end_min: l.end_min,
      original_date: l.date,
      original_start_min: l.start_min,
      original_end_min: l.end_min,
      source: "student",
    })),
  );
  if (error) return { ok: false, error: error.message };

  const total = sorted.length * LESSON_MIN;
  const origin = await siteOrigin();
  const teacherEmail = (schedule.profiles as { email: string }).email;
  await sendMail({
    to: notifyRecipients(teacherEmail),
    subject: `【日程回答${existing ? "（更新）" : ""}】${schedule.title}`,
    text: [
      `${schedule.title} に ${studentName} さんが${existing ? "回答を更新" : "回答"}しました。`,
      ``,
      `--- 選択された授業（${sorted.length}コマ / 合計 ${fmtHours(total)}）---`,
      ...sorted.map((l) => `・${fmtDate(l.date, true)} ${fmtRange(l.start_min, l.end_min)}`),
      ``,
      `管理画面：${origin}/schedules/${schedule.id}`,
    ].join("\n"),
  });

  revalidatePath(`/s/${input.token}`);
  revalidatePath(`/schedules/${schedule.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
