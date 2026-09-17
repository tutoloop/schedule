"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonthCalendar } from "@/components/MonthCalendar";
import { DayTimeline, type Band } from "@/components/DayTimeline";
import { submitResponse } from "@/lib/actions/student";
import { daysUntil, fmtDate, fmtHours, fmtMin, fmtRange, LESSON_MIN, overlaps, STEP_MIN } from "@/lib/time";
import type { Availability, Slot } from "@/lib/types";

type Props = {
  token: string;
  title: string;
  teacherName: string;
  yearMonth: string;
  deadline: string;
  expired: boolean;
  availabilities: Availability[];
  blocked: Slot[];
  initialLessons: Slot[];
  initialName: string;
  answered: boolean;
};

export function StudentResponder(p: Props) {
  const router = useRouter();
  const [name, setName] = useState(p.initialName);
  const [lessons, setLessons] = useState<Slot[]>(p.initialLessons);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const left = daysUntil(p.deadline);

  const availDates = useMemo(() => new Set(p.availabilities.map((a) => a.date)), [p.availabilities]);
  const badges = useMemo(() => {
    const b: Record<string, { label: string; tone: "green" | "orange" }> = {};
    for (const d of availDates) b[d] = { label: "空き", tone: "green" };
    for (const l of lessons) {
      const n = lessons.filter((x) => x.date === l.date).length;
      b[l.date] = { label: `${n}コマ`, tone: "orange" };
    }
    return b;
  }, [availDates, lessons]);

  const dayAvail = p.availabilities.filter((a) => a.date === selected);
  const dayBlocked = p.blocked.filter((b) => b.date === selected);
  const dayMine = lessons.filter((l) => l.date === selected).sort((a, b) => a.start_min - b.start_min);

  /** この開始時刻に90分コマを置けるか */
  const canStart = (s: number) => {
    const e = s + LESSON_MIN;
    if (!dayAvail.some((a) => a.start_min <= s && e <= a.end_min)) return false;
    if (dayBlocked.some((b) => overlaps(s, e, b.start_min, b.end_min))) return false;
    if (dayMine.some((m) => overlaps(s, e, m.start_min, m.end_min))) return false;
    return true;
  };
  const candidates = useMemo(() => {
    const out: number[] = [];
    for (let s = 0; s + LESSON_MIN <= 1440; s += STEP_MIN) if (canStart(s)) out.push(s);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, lessons, p.availabilities, p.blocked]);

  const add = (s: number) => selected && setLessons((prev) => [...prev, { date: selected, start_min: s, end_min: s + LESSON_MIN }]);
  const remove = (l: Slot) => setLessons((prev) => prev.filter((x) => x !== l));

  const bands: Band[] = [
    ...dayAvail.map((a) => ({ start_min: a.start_min, end_min: a.end_min, tone: "avail" as const, label: "空き" })),
    ...dayBlocked.map((b) => ({ start_min: b.start_min, end_min: b.end_min, tone: "blocked" as const, label: "予約済" })),
    ...dayMine.map((m) => ({ start_min: m.start_min, end_min: m.end_min, tone: "mine" as const, onClick: () => remove(m) })),
  ];

  const sorted = [...lessons].sort((a, b) => a.date.localeCompare(b.date) || a.start_min - b.start_min);
  const total = lessons.length * LESSON_MIN;

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await submitResponse({ token: p.token, studentName: name, lessons: sorted });
      if (!r.ok) { setError(r.error); return; }
      setDone(true);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  if (done) {
    return (
      <div className="card text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-green text-3xl font-bold text-white">✓</div>
        <p className="mt-2 text-lg font-bold">回答を送信しました！</p>
        <p className="mt-1 text-sm text-muted">{p.teacherName} 先生に通知しました。</p>
        <ul className="mt-4 space-y-1 text-left text-sm">
          {sorted.map((l, i) => <li key={i} className="rounded-lg bg-bg px-3 py-1.5">{fmtDate(l.date)} {fmtRange(l.start_min, l.end_min)}</li>)}
        </ul>
        <p className="mt-3 text-sm">合計 <b>{sorted.length}コマ / {fmtHours(total)}</b></p>
        <p className="mt-4 text-xs text-muted">回答期限（{fmtDate(p.deadline)}）までは、このURLから変更できます。</p>
        <button type="button" className="btn-ghost mt-3 w-full py-2 text-sm" onClick={() => setDone(false)}>内容を変更する</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-bold">{p.title}</h1>
        <p className="text-sm text-muted">担当：{p.teacherName} 先生</p>
        <div className={`mt-3 rounded-xl px-3 py-2 text-center font-bold ${p.expired ? "bg-gray-200 text-gray-600" : left <= 2 ? "bg-red-50 text-red-600" : "bg-orange/15 text-orange-800"}`}>
          回答期限：{fmtDate(p.deadline, true)}
          {!p.expired && <span className="ml-1 text-sm">{left === 0 ? "（今日まで）" : `（あと${left}日）`}</span>}
        </div>
        {p.expired && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
            回答期限が切れたため変更できません。講師に直接連絡してください。
          </p>
        )}
        {p.answered && !p.expired && (
          <p className="mt-2 text-xs text-muted">すでに回答済みです。期限内であれば内容を変更して再送信できます。</p>
        )}
      </div>

      {p.expired ? (
        p.answered && (
          <div className="card">
            <h2 className="font-bold">回答した内容</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {sorted.map((l, i) => <li key={i} className="rounded-lg bg-bg px-3 py-1.5">{fmtDate(l.date)} {fmtRange(l.start_min, l.end_min)}</li>)}
            </ul>
          </div>
        )
      ) : (
        <>
          <div className="card">
            <label className="label">お名前</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="生徒のお名前" />
          </div>

          <div className="card">
            <p className="mb-2 text-sm text-muted">「空き」のある日をタップして、授業の時間（1コマ90分）を選んでください。何コマでも選べます。</p>
            <MonthCalendar
              yearMonth={p.yearMonth}
              selected={selected}
              onSelect={setSelected}
              badges={badges}
              disabled={(d) => !availDates.has(d) && !lessons.some((l) => l.date === d)}
            />
          </div>

          {selected && (
            <div className="card">
              <h2 className="text-lg font-bold">{fmtDate(selected)}</h2>
              <p className="mb-2 text-xs text-muted">緑＝先生の空き時間、グレー＝他の生徒の予約、オレンジ＝あなたの選択（タップで取消）</p>
              <DayTimeline bands={bands} scrollTo={dayAvail[0]?.start_min ?? 8 * 60} />

              <p className="mt-3 text-sm font-bold">開始時刻を選んで追加：</p>
              {candidates.length === 0 ? (
                <p className="text-sm text-muted">この日に追加できる時間はもうありません</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2">
                  {candidates.map((s) => (
                    <button key={s} type="button" onClick={() => add(s)} className="rounded-full border-2 border-teal/50 bg-white px-3 py-1.5 text-sm font-bold text-teal active:bg-teal/10">
                      {fmtMin(s)}〜{fmtMin(s + LESSON_MIN)}
                    </button>
                  ))}
                </div>
              )}
              {dayMine.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {dayMine.map((m, i) => (
                    <li key={i} className="flex items-center gap-1 rounded-full bg-orange py-1 pr-1 pl-3 text-sm font-bold text-white">
                      {fmtRange(m.start_min, m.end_min)}
                      <button type="button" onClick={() => remove(m)} className="rounded-full px-2 text-white/80" aria-label="取消">×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {sorted.length > 0 && (
            <div className="card">
              <div className="mb-2 font-bold">選択した授業</div>
              <ul className="space-y-1 text-sm">
                {sorted.map((l, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-bg px-3 py-1.5">
                    <span>{fmtDate(l.date)} {fmtRange(l.start_min, l.end_min)}</span>
                    <button type="button" onClick={() => remove(l)} className="px-2 text-muted" aria-label="取消">×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}

          <div className="sticky bottom-0 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted">
                <b className="text-lg text-ink">{lessons.length}</b>コマ / <b className="text-ink">{fmtHours(total)}</b>
              </div>
              <button type="button" onClick={submit} disabled={pending || lessons.length === 0 || !name.trim()} className="btn-accent flex-1">
                {pending ? "送信中..." : p.answered ? "変更を送信する" : "回答完了"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
