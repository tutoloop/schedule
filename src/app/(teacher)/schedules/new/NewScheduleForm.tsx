"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonthCalendar } from "@/components/MonthCalendar";
import { DayTimeline, type Band } from "@/components/DayTimeline";
import { TimeSelect } from "@/components/TimeSelect";
import { createSchedule } from "@/lib/actions/schedules";
import { addMonths, daysInMonth, fmtDate, fmtMin, fmtMonthShort, fmtRange, STEP_MIN, weekdayOf, WEEKDAYS } from "@/lib/time";
import type { Slot } from "@/lib/types";

export function NewScheduleForm({ initialMonth, today }: { initialMonth: string; today: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [manualStart, setManualStart] = useState(10 * 60);
  const [manualEnd, setManualEnd] = useState(12 * 60);
  const [studentName, setStudentName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const daySlots = useMemo(
    () => slots.filter((s) => s.date === selected).sort((a, b) => a.start_min - b.start_min),
    [slots, selected],
  );
  const badges = useMemo(() => {
    const b: Record<string, { label: string; tone: "green" }> = {};
    for (const s of slots) {
      const n = slots.filter((x) => x.date === s.date).length;
      b[s.date] = { label: `${n}枠`, tone: "green" };
    }
    return b;
  }, [slots]);

  const changeMonth = (n: number) => {
    const next = addMonths(month, n);
    if (slots.length > 0 && !confirm("月を変えると設定した空き時間はクリアされます。よろしいですか？")) return;
    setMonth(next);
    setSlots([]);
    setSelected(null);
    setPendingStart(null);
  };

  /** 空き時間帯を追加（毎週◯曜オプション対応） */
  const addSlot = (start: number, end: number) => {
    if (!selected) return;
    const dates = repeatWeekly
      ? daysInMonth(month).filter((d) => weekdayOf(d) === weekdayOf(selected) && d >= selected)
      : [selected];
    setSlots((prev) => {
      const next = [...prev];
      for (const date of dates) {
        // 既存と重なる場合は結合
        const same = next.filter((s) => s.date === date && s.start_min <= end && start <= s.end_min);
        const merged = {
          date,
          start_min: Math.min(start, ...same.map((s) => s.start_min)),
          end_min: Math.max(end, ...same.map((s) => s.end_min)),
        };
        for (const s of same) next.splice(next.indexOf(s), 1);
        next.push(merged);
      }
      return next;
    });
    setPendingStart(null);
  };

  const removeSlot = (slot: Slot) => setSlots((prev) => prev.filter((s) => s !== slot));

  const onCellTap = (cellStart: number) => {
    if (pendingStart === null) {
      setPendingStart(cellStart);
      return;
    }
    const end = cellStart + STEP_MIN;
    if (end <= pendingStart) {
      setPendingStart(cellStart);
      return;
    }
    addSlot(pendingStart, end);
  };

  const bands: Band[] = [
    ...daySlots.map((s) => ({ ...s, tone: "avail" as const, onClick: () => removeSlot(s) })),
    ...(pendingStart !== null
      ? [{ start_min: pendingStart, end_min: pendingStart + STEP_MIN, tone: "pending" as const, label: `${fmtMin(pendingStart)}〜` }]
      : []),
  ];

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createSchedule({ yearMonth: month, studentName, deadline, slots });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/schedules/${res.id}?created=1`);
    });
  };

  const totalDays = new Set(slots.map((s) => s.date)).size;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">日程調整を作成</h1>

      <section className="card">
        <p className="mb-3 text-sm text-muted">① 対象の月を選び、空いている日をタップして時間帯を設定します</p>
        <MonthCalendar
          yearMonth={month}
          selected={selected}
          onSelect={(d) => { setSelected(d); setPendingStart(null); }}
          badges={badges}
          disabled={(d) => d < today}
          onPrevMonth={() => changeMonth(-1)}
          onNextMonth={() => changeMonth(1)}
          today={today}
        />
      </section>

      {selected && (
        <section className="card">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">{fmtDate(selected)} の空き時間</h2>
            <span className="text-xs text-muted">30分単位</span>
          </div>
          <p className="mb-2 text-xs text-muted">
            バーを横にスクロールし、<b>開始</b>のマスをタップ → <b>終了</b>のマスをタップで追加。緑の帯をタップすると削除。
          </p>
          <DayTimeline bands={bands} onCellTap={onCellTap} scrollTo={pendingStart ?? 8 * 60} />
          {pendingStart !== null && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-teal/10 px-3 py-2 text-sm">
              <span>開始 <b>{fmtMin(pendingStart)}</b> → 終了のマスをタップ</span>
              <button type="button" className="text-muted underline" onClick={() => setPendingStart(null)}>取消</button>
            </div>
          )}

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">時刻を選んで追加する</summary>
            <div className="mt-2 flex items-center gap-2">
              <TimeSelect value={manualStart} onChange={setManualStart} max={1440 - STEP_MIN} />
              <span>〜</span>
              <TimeSelect value={manualEnd} onChange={setManualEnd} min={STEP_MIN} />
              <button
                type="button"
                className="btn-ghost shrink-0 py-2"
                onClick={() => manualEnd > manualStart ? addSlot(manualStart, manualEnd) : alert("終了は開始より後にしてください")}
              >追加</button>
            </div>
          </details>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={repeatWeekly} onChange={(e) => setRepeatWeekly(e.target.checked)} className="size-4 accent-teal" />
            追加するとき、{fmtMonthShort(month)}の毎週{WEEKDAYS[weekdayOf(selected)]}曜（この日以降）にも同じ時間を入れる
          </label>

          <ul className="mt-3 flex flex-wrap gap-2">
            {daySlots.length === 0 && <li className="text-sm text-muted">まだ空き時間がありません</li>}
            {daySlots.map((s) => (
              <li key={`${s.start_min}-${s.end_min}`} className="flex items-center gap-1 rounded-full bg-green/20 py-1 pr-1 pl-3 text-sm font-bold text-green-900">
                {fmtRange(s.start_min, s.end_min)}
                <button type="button" onClick={() => removeSlot(s)} className="rounded-full px-2 text-green-900/60 hover:bg-green/30" aria-label="削除">×</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-3">
        <p className="text-sm text-muted">② タイトルと回答期限を設定してURLを作成します</p>
        <div>
          <label className="label">タイトル</label>
          <div className="flex items-center gap-1">
            <span className="shrink-0 rounded-xl bg-bg px-3 py-2.5 font-bold text-muted">{fmtMonthShort(month)}分_</span>
            <input value={studentName} onChange={(e) => setStudentName(e.target.value)} className="input" placeholder="生徒名（例：山田太郎）" />
          </div>
        </div>
        <div>
          <label className="label">回答期限</label>
          <input type="date" value={deadline} min={today} onChange={(e) => setDeadline(e.target.value)} className="input" />
          <p className="mt-1 text-xs text-muted">期限日の23:59まで生徒は回答・変更ができます</p>
        </div>
        <div className="rounded-xl bg-bg px-3 py-2 text-sm">
          設定済み：<b>{totalDays}日 / {slots.length}枠</b>
          <span className="ml-2 text-xs text-muted">※URL作成後は空き時間を変更できません</span>
        </div>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}
        <button type="button" onClick={submit} disabled={pending} className="btn-accent w-full text-base">
          {pending ? "作成中..." : "URLを作成"}
        </button>
      </section>
    </div>
  );
}
