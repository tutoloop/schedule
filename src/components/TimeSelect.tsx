"use client";

import { fmtMin, STEP_MIN } from "@/lib/time";

/** 30分刻みの時刻セレクト */
export function TimeSelect({ value, onChange, min = 0, max = 1440, className = "" }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const opts: number[] = [];
  for (let m = min; m <= max; m += STEP_MIN) opts.push(m);
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={`input ${className}`}>
      {opts.map((m) => (
        <option key={m} value={m}>{fmtMin(m)}</option>
      ))}
    </select>
  );
}
