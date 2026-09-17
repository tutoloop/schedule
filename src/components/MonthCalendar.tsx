"use client";

import { daysInMonth, fmtMonth, weekdayOf, WEEKDAYS } from "@/lib/time";

type Props = {
  yearMonth: string;
  selected?: string | null;
  onSelect?: (date: string) => void;
  /** 日付ごとのバッジ（例：空き時間帯数やコマ数） */
  badges?: Record<string, { label: string; tone: "green" | "orange" | "blue" | "gray" }>;
  /** 選択不可の日 */
  disabled?: (date: string) => boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  today?: string;
};

const tones = {
  green: "bg-green/20 text-green-800",
  orange: "bg-orange/20 text-orange-800",
  blue: "bg-blue/15 text-blue-dark",
  gray: "bg-gray-200 text-gray-500",
};

export function MonthCalendar({ yearMonth, selected, onSelect, badges = {}, disabled, onPrevMonth, onNextMonth, today }: Props) {
  const days = daysInMonth(yearMonth);
  const lead = weekdayOf(days[0]);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        {onPrevMonth ? (
          <button type="button" onClick={onPrevMonth} className="rounded-full px-3 py-1 text-xl text-muted hover:bg-bg" aria-label="前の月">‹</button>
        ) : <span />}
        <div className="font-bold">{fmtMonth(yearMonth)}</div>
        {onNextMonth ? (
          <button type="button" onClick={onNextMonth} className="rounded-full px-3 py-1 text-xl text-muted hover:bg-bg" aria-label="次の月">›</button>
        ) : <span />}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={i === 0 ? "text-red-400" : i === 6 ? "text-blue" : ""}>{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
        {days.map((d) => {
          const wd = weekdayOf(d);
          const isDisabled = disabled?.(d) ?? false;
          const isSel = selected === d;
          const badge = badges[d];
          const isToday = today === d;
          return (
            <button
              key={d}
              type="button"
              disabled={isDisabled || !onSelect}
              onClick={() => onSelect?.(d)}
              className={[
                "flex aspect-square flex-col items-center justify-start rounded-xl border-2 pt-1 text-sm transition",
                isSel ? "border-teal bg-teal/10" : "border-transparent",
                isDisabled ? "text-gray-300" : "hover:bg-bg",
                !isDisabled && wd === 0 ? "text-red-400" : "",
                !isDisabled && wd === 6 ? "text-blue" : "",
              ].join(" ")}
            >
              <span className={["leading-none font-bold", isToday ? "rounded-full bg-ink px-1.5 py-0.5 text-white" : ""].join(" ")}>
                {Number(d.slice(-2))}
              </span>
              {badge && (
                <span className={`mt-1 rounded-md px-1 text-[10px] leading-4 font-bold ${tones[badge.tone]}`}>{badge.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
