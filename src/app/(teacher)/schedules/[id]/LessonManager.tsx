"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TimeSelect } from "@/components/TimeSelect";
import { addLesson, deleteLesson, updateLesson } from "@/lib/actions/schedules";
import { fmtDate, fmtHours, fmtRange, LESSON_MIN, STEP_MIN } from "@/lib/time";
import type { Lesson, LessonEdit } from "@/lib/types";

type Props = { scheduleId: string; yearMonth: string; lessons: Lesson[]; edits: LessonEdit[] };

export function LessonManager({ scheduleId, yearMonth, lessons, edits }: Props) {
  const router = useRouter();
  const active = lessons.filter((l) => l.status === "active");
  const total = active.reduce((a, l) => a + (l.end_min - l.start_min), 0);
  const [editing, setEditing] = useState<string | null>(null); // lessonId
  const [deleting, setDeleting] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const done = (m: string) => {
    setEditing(null); setDeleting(null); setAdding(false); setMsg(m);
    router.refresh();
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">授業時間</h2>
        <div className="text-sm text-muted">
          {active.length}コマ / 合計 <b className="text-lg text-ink">{fmtHours(total)}</b>
        </div>
      </div>
      {msg && <p className="mt-2 rounded-xl bg-green/15 px-3 py-2 text-sm font-bold text-green-900">{msg}</p>}

      {active.length === 0 ? (
        <p className="mt-3 text-sm text-muted">まだ授業コマがありません（生徒の回答待ち、または下から追加）</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {active.map((l) => {
            const changed = l.date !== l.original_date || l.start_min !== l.original_start_min || l.end_min !== l.original_end_min;
            return (
              <li key={l.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    {changed && (
                      <div className="text-[11px] text-muted line-through">
                        {fmtDate(l.original_date)} {fmtRange(l.original_start_min, l.original_end_min)}
                      </div>
                    )}
                    <div className="font-bold">
                      <span className="mr-2 inline-block w-16">{fmtDate(l.date)}</span>
                      {fmtRange(l.start_min, l.end_min)}
                      <span className="ml-2 text-xs font-normal text-muted">{fmtHours(l.end_min - l.start_min)}</span>
                      {l.source === "teacher" && <span className="ml-1 rounded bg-blue/10 px-1 text-[10px] text-blue-dark">講師追加</span>}
                      {changed && <span className="ml-1 rounded bg-orange/15 px-1 text-[10px] text-orange-800">編集済</span>}
                    </div>
                  </div>
                  <button type="button" className="rounded-full border border-line px-3 py-1 text-xs font-bold" onClick={() => { setEditing(editing === l.id ? null : l.id); setDeleting(null); }}>編集</button>
                  <button type="button" className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-500" onClick={() => { setDeleting(deleting === l.id ? null : l.id); setEditing(null); }}>削除</button>
                </div>
                {editing === l.id && <EditForm lesson={l} onDone={() => done("変更しました。通知メールを送信しました。")} onCancel={() => setEditing(null)} />}
                {deleting === l.id && <DeleteForm lesson={l} onDone={() => done("削除しました。通知メールを送信しました。")} onCancel={() => setDeleting(null)} />}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3">
        {adding ? (
          <AddForm scheduleId={scheduleId} yearMonth={yearMonth} onDone={() => done("追加しました。通知メールを送信しました。")} onCancel={() => setAdding(false)} />
        ) : (
          <button type="button" className="btn-ghost w-full py-2 text-sm" onClick={() => { setAdding(true); setEditing(null); setDeleting(null); }}>＋ コマを追加</button>
        )}
      </div>

      {edits.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-bold text-muted">編集履歴（{edits.length}件）</summary>
          <ul className="mt-2 space-y-2 text-xs">
            {edits.map((e) => (
              <li key={e.id} className="rounded-lg bg-bg p-2">
                <div className="flex justify-between text-muted">
                  <span>{new Date(e.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
                  <span>{e.editor_email}</span>
                </div>
                <div className="mt-1 font-bold">
                  {e.action === "update" && <>変更：{fmtDate(e.before_date!)} {fmtRange(e.before_start_min!, e.before_end_min!)} → {fmtDate(e.after_date!)} {fmtRange(e.after_start_min!, e.after_end_min!)}</>}
                  {e.action === "delete" && <>削除：{fmtDate(e.before_date!)} {fmtRange(e.before_start_min!, e.before_end_min!)}</>}
                  {e.action === "add" && <>追加：{fmtDate(e.after_date!)} {fmtRange(e.after_start_min!, e.after_end_min!)}</>}
                </div>
                <div className="mt-0.5">理由：{e.reason}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">理由 <span className="text-red-500">*必須</span></label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input" placeholder="例：体調不良のため振替 / 授業時間延長" />
    </div>
  );
}

function EditForm({ lesson, onDone, onCancel }: { lesson: Lesson; onDone: () => void; onCancel: () => void }) {
  const [date, setDate] = useState(lesson.date);
  const [start, setStart] = useState(lesson.start_min);
  const [end, setEnd] = useState(lesson.end_min);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  return (
    <div className="mt-2 space-y-2 rounded-xl border-2 border-teal/40 bg-teal/5 p-3">
      <div className="text-xs text-muted">変更前：{fmtDate(lesson.date)} {fmtRange(lesson.start_min, lesson.end_min)}</div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input col-span-3" />
        <TimeSelect value={start} onChange={(v) => { setStart(v); if (end <= v) setEnd(Math.min(1440, v + LESSON_MIN)); }} max={1440 - STEP_MIN} />
        <span>〜</span>
        <TimeSelect value={end} onChange={setEnd} min={start + STEP_MIN} />
      </div>
      <ReasonField value={reason} onChange={setReason} />
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex-1 py-2 text-sm" onClick={onCancel}>キャンセル</button>
        <button
          type="button"
          disabled={pending || !reason.trim()}
          className="btn-primary flex-1 py-2 text-sm"
          onClick={() => run(async () => {
            const r = await updateLesson({ lessonId: lesson.id, date, start_min: start, end_min: end, reason });
            if (!r.ok) setError(r.error); else onDone();
          })}
        >{pending ? "保存中..." : "変更を保存"}</button>
      </div>
    </div>
  );
}

function DeleteForm({ lesson, onDone, onCancel }: { lesson: Lesson; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  return (
    <div className="mt-2 space-y-2 rounded-xl border-2 border-red-200 bg-red-50 p-3">
      <div className="text-sm">このコマを削除します：<b>{fmtDate(lesson.date)} {fmtRange(lesson.start_min, lesson.end_min)}</b></div>
      <ReasonField value={reason} onChange={setReason} />
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex-1 py-2 text-sm" onClick={onCancel}>キャンセル</button>
        <button
          type="button"
          disabled={pending || !reason.trim()}
          className="btn flex-1 bg-red-500 py-2 text-sm text-white"
          onClick={() => run(async () => {
            const r = await deleteLesson({ lessonId: lesson.id, reason });
            if (!r.ok) setError(r.error); else onDone();
          })}
        >{pending ? "削除中..." : "削除する"}</button>
      </div>
    </div>
  );
}

function AddForm({ scheduleId, yearMonth, onDone, onCancel }: { scheduleId: string; yearMonth: string; onDone: () => void; onCancel: () => void }) {
  const [date, setDate] = useState(`${yearMonth}-01`);
  const [start, setStart] = useState(17 * 60);
  const [end, setEnd] = useState(17 * 60 + LESSON_MIN);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  return (
    <div className="space-y-2 rounded-xl border-2 border-blue/30 bg-blue/5 p-3">
      <div className="font-bold">コマを追加</div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input col-span-3" />
        <TimeSelect value={start} onChange={(v) => { setStart(v); if (end <= v) setEnd(Math.min(1440, v + LESSON_MIN)); }} max={1440 - STEP_MIN} />
        <span>〜</span>
        <TimeSelect value={end} onChange={setEnd} min={start + STEP_MIN} />
      </div>
      <ReasonField value={reason} onChange={setReason} />
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex-1 py-2 text-sm" onClick={onCancel}>キャンセル</button>
        <button
          type="button"
          disabled={pending || !reason.trim()}
          className="btn-primary flex-1 py-2 text-sm"
          onClick={() => run(async () => {
            const r = await addLesson({ scheduleId, date, start_min: start, end_min: end, reason });
            if (!r.ok) setError(r.error); else onDone();
          })}
        >{pending ? "追加中..." : "追加する"}</button>
      </div>
    </div>
  );
}
