"use client";

import { useTransition } from "react";
import { deleteSchedule } from "@/lib/actions/schedules";

export function DeleteScheduleButton({ scheduleId }: { scheduleId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-red-400 underline"
      onClick={() => {
        if (!confirm("この日程調整を削除します。回答・授業コマ・履歴もすべて消えます。よろしいですか？")) return;
        if (!confirm("本当に削除しますか？（元に戻せません）")) return;
        start(() => deleteSchedule(scheduleId));
      }}
    >
      {pending ? "削除中..." : "この日程調整を削除する"}
    </button>
  );
}
