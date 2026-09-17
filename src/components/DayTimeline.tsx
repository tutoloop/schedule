"use client";

import { useEffect, useRef } from "react";
import { fmtMin, STEP_MIN } from "@/lib/time";

export type Band = { start_min: number; end_min: number; tone: "avail" | "blocked" | "mine" | "pending"; label?: string; onClick?: () => void };

type Props = {
  bands: Band[];
  /** セルをタップしたとき（セルの開始分数）。無効セルは呼ばれない */
  onCellTap?: (startMin: number) => void;
  /** セルが有効か */
  cellEnabled?: (startMin: number) => boolean;
  /** 初期スクロール位置（分） */
  scrollTo?: number;
};

const CELL_W = 40; // px / 30分
const CELLS = 1440 / STEP_MIN;

const toneCls: Record<Band["tone"], string> = {
  avail: "bg-green/25 border-green/60",
  blocked: "bg-gray-300/70 border-gray-400 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,.08)_6px,rgba(0,0,0,.08)_12px)]",
  mine: "bg-orange/80 border-orange text-white",
  pending: "bg-teal/40 border-teal",
};

/** 0:00〜24:00 を横スクロールで表示するタイムライン。30分 = 1セル。 */
export function DayTimeline({ bands, onCellTap, cellEnabled, scrollTo = 8 * 60 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = (scrollTo / STEP_MIN) * CELL_W - 8;
    // 初回のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="no-scrollbar -mx-4 overflow-x-auto px-4">
      <div className="relative" style={{ width: CELLS * CELL_W }}>
        {/* 時刻ラベル */}
        <div className="flex h-5 text-[10px] text-muted">
          {Array.from({ length: 25 }).map((_, h) => (
            <div key={h} className="absolute" style={{ left: h * 2 * CELL_W - 8, top: 0 }}>{h}</div>
          ))}
        </div>
        {/* セル */}
        <div className="flex h-14 rounded-lg border border-line bg-white">
          {Array.from({ length: CELLS }).map((_, i) => {
            const start = i * STEP_MIN;
            const enabled = cellEnabled ? cellEnabled(start) : !!onCellTap;
            return (
              <button
                key={i}
                type="button"
                disabled={!enabled}
                onClick={() => onCellTap?.(start)}
                className={[
                  "h-full shrink-0 border-r",
                  i % 2 === 1 ? "border-line" : "border-line/40",
                  enabled ? "active:bg-teal/20" : "",
                ].join(" ")}
                style={{ width: CELL_W }}
                aria-label={fmtMin(start)}
              />
            );
          })}
        </div>
        {/* バンド */}
        {bands.map((b, i) => (
          <div
            key={i}
            onClick={b.onClick}
            className={[
              "absolute top-5 flex h-14 items-center justify-center overflow-hidden rounded-md border text-[11px] font-bold",
              toneCls[b.tone],
              b.onClick ? "cursor-pointer" : "pointer-events-none",
            ].join(" ")}
            style={{ left: (b.start_min / STEP_MIN) * CELL_W, width: ((b.end_min - b.start_min) / STEP_MIN) * CELL_W }}
          >
            {b.label ?? `${fmtMin(b.start_min)}〜${fmtMin(b.end_min)}`}
          </div>
        ))}
      </div>
    </div>
  );
}
