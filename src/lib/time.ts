/** 時刻・日付ユーティリティ。日付は 'YYYY-MM-DD'、時刻は 0:00 からの分数で扱う。 */

export const LESSON_MIN = 90; // 1コマ90分
export const STEP_MIN = 30; // 30分刻み
export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, "0")}`;
}

export function fmtRange(start: number, end: number) {
  return `${fmtMin(start)}〜${fmtMin(end)}`;
}

/** 'YYYY-MM-DD' → 曜日番号 (0=日) */
export function weekdayOf(date: string) {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

/** 'YYYY-MM-DD' → '9/17(水)' */
export function fmtDate(date: string, withYear = false) {
  const [y, m, d] = date.split("-").map(Number);
  const wd = WEEKDAYS[weekdayOf(date)];
  return withYear ? `${y}/${m}/${d}(${wd})` : `${m}/${d}(${wd})`;
}

/** 'YYYY-MM' → '2026年9月' */
export function fmtMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${y}年${m}月`;
}

/** 'YYYY-MM' → '9月' */
export function fmtMonthShort(ym: string) {
  return `${Number(ym.split("-")[1])}月`;
}

/** 日本時間の今日 'YYYY-MM-DD' */
export function todayJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 日本時間の今月 'YYYY-MM' */
export function thisMonthJST() {
  return todayJST().slice(0, 7);
}

export function addMonths(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 月に含まれる日付をすべて返す */
export function daysInMonth(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from(
    { length: last },
    (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`,
  );
}

/** 回答期限が過ぎているか（期限日の23:59まで有効） */
export function isExpired(deadline: string) {
  return todayJST() > deadline;
}

/** 期限まで何日か（0=今日、負=過ぎている） */
export function daysUntil(deadline: string) {
  const a = new Date(deadline + "T00:00:00Z").getTime();
  const b = new Date(todayJST() + "T00:00:00Z").getTime();
  return Math.round((a - b) / 86400000);
}

export function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && bStart < aEnd;
}

/** 分数を '1.5時間' の形式に */
export function fmtHours(min: number) {
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}時間`;
}
