"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { notifyRecipients, sendMail } from "@/lib/mail";
import { fmtDate, fmtHours, fmtRange, overlaps, STEP_MIN } from "@/lib/time";
import type { Lesson, Schedule, Slot } from "@/lib/types";
import { siteOrigin } from "@/lib/site";

type Result = { ok: true } | { ok: false; error: string };

/** 講師が日程調整を作成しURLを発行する */
export async function createSchedule(input: {
  yearMonth: string;
  studentName: string;
  deadline: string;
  slots: Slot[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const studentName = input.studentName.trim();
  if (!/^\d{4}-\d{2}$/.test(input.yearMonth)) return { ok: false, error: "月が不正です" };
  if (!studentName) return { ok: false, error: "生徒名を入力してください" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deadline)) return { ok: false, error: "回答期限を設定してください" };
  if (input.slots.length === 0) return { ok: false, error: "空き時間を1つ以上設定してください" };
  for (const s of input.slots) {
    if (!s.date.startsWith(input.yearMonth)) return { ok: false, error: "対象月以外の日付が含まれています" };
    if (s.start_min % STEP_MIN || s.end_min % STEP_MIN || s.end_min <= s.start_min)
      return { ok: false, error: "空き時間の指定が不正です" };
  }

  const admin = createAdminClient();
  const title = `${Number(input.yearMonth.split("-")[1])}月分_${studentName}`;
  const token = randomBytes(12).toString("base64url");

  const { data: schedule, error } = await admin
    .from("schedules")
    .insert({
      teacher_id: user.id,
      title,
      student_name: studentName,
      year_month: input.yearMonth,
      deadline: input.deadline,
      token,
    })
    .select()
    .single();
  if (error || !schedule) return { ok: false, error: error?.message ?? "作成に失敗しました" };

  const { error: e2 } = await admin.from("availabilities").insert(
    mergeSlots(input.slots).map((s) => ({ schedule_id: schedule.id, ...s })),
  );
  if (e2) {
    await admin.from("schedules").delete().eq("id", schedule.id);
    return { ok: false, error: e2.message };
  }
  revalidatePath("/dashboard");
  return { ok: true, id: schedule.id };
}

/** 同じ日の重なる時間帯を結合する */
function mergeSlots(slots: Slot[]): Slot[] {
  const byDate = new Map<string, Slot[]>();
  for (const s of slots) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const out: Slot[] = [];
  for (const [date, list] of byDate) {
    list.sort((a, b) => a.start_min - b.start_min);
    let cur = { ...list[0] };
    for (const s of list.slice(1)) {
      if (s.start_min <= cur.end_min) cur.end_min = Math.max(cur.end_min, s.end_min);
      else {
        out.push(cur);
        cur = { ...s };
      }
    }
    out.push(cur);
    void date;
  }
  return out;
}

/** 講師（またはマスター）がこの日程調整を操作できるか確認し、講師メールを返す */
async function authorizeSchedule(scheduleId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: schedule } = await admin
    .from("schedules")
    .select("*, profiles!inner(email, name)")
    .eq("id", scheduleId)
    .single();
  if (!schedule) throw new Error("日程調整が見つかりません");
  if (!user.isMaster && schedule.teacher_id !== user.id) throw new Error("権限がありません");
  const teacher = schedule.profiles as { email: string; name: string | null };
  return { user, admin, schedule: schedule as Schedule, teacherEmail: teacher.email };
}

/** 既存コマと重なっていないか（同じ講師の全生徒分で確認） */
async function checkConflict(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string,
  date: string,
  start: number,
  end: number,
  excludeLessonId?: string,
) {
  const { data } = await admin
    .from("lessons")
    .select("id, start_min, end_min, schedules!inner(teacher_id, student_name)")
    .eq("date", date)
    .eq("status", "active")
    .eq("schedules.teacher_id", teacherId);
  for (const l of data ?? []) {
    if (l.id === excludeLessonId) continue;
    if (overlaps(start, end, l.start_min, l.end_min)) {
      const s = l.schedules as unknown as { student_name: string };
      return `${fmtDate(date)} ${fmtRange(l.start_min, l.end_min)} は ${s.student_name} さんの授業と重なっています`;
    }
  }
  return null;
}

function validateTime(date: string, start: number, end: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "日付が不正です";
  if (start % STEP_MIN || end % STEP_MIN) return "時刻は30分単位で指定してください";
  if (start < 0 || end > 1440 || end <= start) return "時刻の範囲が不正です";
  return null;
}

export async function updateLesson(input: {
  lessonId: string;
  date: string;
  start_min: number;
  end_min: number;
  reason: string;
}): Promise<Result> {
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "編集理由を入力してください" };
  const v = validateTime(input.date, input.start_min, input.end_min);
  if (v) return { ok: false, error: v };

  const admin0 = createAdminClient();
  const { data: lesson } = await admin0.from("lessons").select("*").eq("id", input.lessonId).single();
  if (!lesson || lesson.status !== "active") return { ok: false, error: "コマが見つかりません" };
  const { user, admin, schedule, teacherEmail } = await authorizeSchedule(lesson.schedule_id);

  if (
    lesson.date === input.date &&
    lesson.start_min === input.start_min &&
    lesson.end_min === input.end_min
  )
    return { ok: false, error: "変更がありません" };

  const conflict = await checkConflict(admin, schedule.teacher_id, input.date, input.start_min, input.end_min, lesson.id);
  if (conflict) return { ok: false, error: conflict };

  const { error } = await admin
    .from("lessons")
    .update({ date: input.date, start_min: input.start_min, end_min: input.end_min, updated_at: new Date().toISOString() })
    .eq("id", lesson.id);
  if (error) return { ok: false, error: error.message };
  await admin.from("lesson_edits").insert({
    lesson_id: lesson.id,
    schedule_id: schedule.id,
    editor_id: user.id,
    editor_email: user.email,
    action: "update",
    before_date: lesson.date,
    before_start_min: lesson.start_min,
    before_end_min: lesson.end_min,
    after_date: input.date,
    after_start_min: input.start_min,
    after_end_min: input.end_min,
    reason,
  });

  await notifyEdit(schedule, teacherEmail, user.email, [
    `【変更】`,
    `変更前：${fmtDate(lesson.date, true)} ${fmtRange(lesson.start_min, lesson.end_min)}`,
    `変更後：${fmtDate(input.date, true)} ${fmtRange(input.start_min, input.end_min)}`,
    `理由：${reason}`,
  ]);
  revalidatePath(`/schedules/${schedule.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteLesson(input: { lessonId: string; reason: string }): Promise<Result> {
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "削除理由を入力してください" };
  const admin0 = createAdminClient();
  const { data: lesson } = await admin0.from("lessons").select("*").eq("id", input.lessonId).single();
  if (!lesson || lesson.status !== "active") return { ok: false, error: "コマが見つかりません" };
  const { user, admin, schedule, teacherEmail } = await authorizeSchedule(lesson.schedule_id);

  const { error } = await admin
    .from("lessons")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", lesson.id);
  if (error) return { ok: false, error: error.message };
  await admin.from("lesson_edits").insert({
    lesson_id: lesson.id,
    schedule_id: schedule.id,
    editor_id: user.id,
    editor_email: user.email,
    action: "delete",
    before_date: lesson.date,
    before_start_min: lesson.start_min,
    before_end_min: lesson.end_min,
    reason,
  });
  await notifyEdit(schedule, teacherEmail, user.email, [
    `【削除】`,
    `削除したコマ：${fmtDate(lesson.date, true)} ${fmtRange(lesson.start_min, lesson.end_min)}`,
    `理由：${reason}`,
  ]);
  revalidatePath(`/schedules/${schedule.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addLesson(input: {
  scheduleId: string;
  date: string;
  start_min: number;
  end_min: number;
  reason: string;
}): Promise<Result> {
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "追加理由を入力してください" };
  const v = validateTime(input.date, input.start_min, input.end_min);
  if (v) return { ok: false, error: v };
  const { user, admin, schedule, teacherEmail } = await authorizeSchedule(input.scheduleId);

  const conflict = await checkConflict(admin, schedule.teacher_id, input.date, input.start_min, input.end_min);
  if (conflict) return { ok: false, error: conflict };

  const { data: lesson, error } = await admin
    .from("lessons")
    .insert({
      schedule_id: schedule.id,
      date: input.date,
      start_min: input.start_min,
      end_min: input.end_min,
      original_date: input.date,
      original_start_min: input.start_min,
      original_end_min: input.end_min,
      source: "teacher",
    })
    .select()
    .single();
  if (error || !lesson) return { ok: false, error: error?.message ?? "追加に失敗しました" };
  await admin.from("lesson_edits").insert({
    lesson_id: lesson.id,
    schedule_id: schedule.id,
    editor_id: user.id,
    editor_email: user.email,
    action: "add",
    after_date: input.date,
    after_start_min: input.start_min,
    after_end_min: input.end_min,
    reason,
  });
  await notifyEdit(schedule, teacherEmail, user.email, [
    `【追加】`,
    `追加したコマ：${fmtDate(input.date, true)} ${fmtRange(input.start_min, input.end_min)}`,
    `理由：${reason}`,
  ]);
  revalidatePath(`/schedules/${schedule.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

async function notifyEdit(schedule: Schedule, teacherEmail: string, editorEmail: string, lines: string[]) {
  const admin = createAdminClient();
  const { data: lessons } = await admin
    .from("lessons")
    .select("*")
    .eq("schedule_id", schedule.id)
    .eq("status", "active")
    .order("date")
    .order("start_min");
  const total = (lessons ?? []).reduce((a, l) => a + (l.end_min - l.start_min), 0);
  const origin = await siteOrigin();
  await sendMail({
    to: notifyRecipients(teacherEmail),
    subject: `【日程編集】${schedule.title}`,
    text: [
      `${schedule.title} の授業日程が編集されました。`,
      ``,
      `編集者：${editorEmail}`,
      ...lines,
      ``,
      `--- 現在の授業一覧（合計 ${fmtHours(total)}）---`,
      ...(lessons ?? []).map((l: Lesson) => `・${fmtDate(l.date, true)} ${fmtRange(l.start_min, l.end_min)}`),
      ``,
      `管理画面：${origin}/schedules/${schedule.id}`,
    ].join("\n"),
  });
}

export async function deleteSchedule(scheduleId: string) {
  const { admin, schedule } = await authorizeSchedule(scheduleId);
  await admin.from("schedules").delete().eq("id", schedule.id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
