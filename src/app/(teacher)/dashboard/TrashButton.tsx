"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteScheduleInPlace } from "@/lib/actions/schedules";

export function TrashButton({ scheduleId, answered, title }: { scheduleId: string; answered: boolean; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`${title} を削除`}
      title="削除"
      className="absolute right-4 bottom-3 rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
      onClick={() => {
        if (!answered && !confirm(`「${title}」はまだ生徒の回答がありませんが、削除しても大丈夫ですか？`)) return;
        start(async () => {
          await deleteScheduleInPlace(scheduleId);
          router.refresh();
        });
      }}
    >
      {pending ? (
        <span className="block size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      )}
    </button>
  );
}
