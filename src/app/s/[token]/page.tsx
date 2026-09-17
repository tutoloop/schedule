import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExpired } from "@/lib/time";
import { one, type Availability, type Slot } from "@/lib/types";
import { StudentResponder } from "./StudentResponder";

export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: schedule } = await admin
    .from("schedules")
    .select("id, teacher_id, title, student_name, year_month, deadline, profiles!inner(name), responses(student_name)")
    .eq("token", token)
    .single();

  if (!schedule) {
    return (
      <Shell>
        <div className="card text-center">
          <p className="font-bold">この日程調整は見つかりませんでした</p>
          <p className="mt-1 text-sm text-muted">URLが正しいか確認するか、講師にお問い合わせください。</p>
        </div>
      </Shell>
    );
  }

  const [{ data: avail }, { data: mine }, { data: others }] = await Promise.all([
    admin.from("availabilities").select("*").eq("schedule_id", schedule.id),
    admin.from("lessons").select("date, start_min, end_min").eq("schedule_id", schedule.id).eq("status", "active"),
    admin
      .from("lessons")
      .select("date, start_min, end_min, schedules!inner(teacher_id)")
      .eq("status", "active")
      .eq("schedules.teacher_id", schedule.teacher_id)
      .neq("schedule_id", schedule.id)
      .gte("date", `${schedule.year_month}-01`)
      .lte("date", `${schedule.year_month}-31`),
  ]);

  const teacher = schedule.profiles as unknown as { name: string | null };
  const response = one(schedule.responses as { student_name: string }[] | { student_name: string } | null);

  return (
    <Shell>
      <StudentResponder
        token={token}
        title={schedule.title}
        teacherName={teacher.name ?? "講師"}
        yearMonth={schedule.year_month}
        deadline={schedule.deadline}
        expired={isExpired(schedule.deadline)}
        availabilities={(avail ?? []) as Availability[]}
        blocked={(others ?? []).map((o) => ({ date: o.date, start_min: o.start_min, end_min: o.end_min })) as Slot[]}
        initialLessons={(mine ?? []) as Slot[]}
        initialName={response?.student_name ?? schedule.student_name}
        answered={!!response}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5">
      <div className="mb-4 flex flex-col items-center">
        <Image src="/logo.jpg" alt="TUTOLOOP" width={140} height={146} priority />
        <p className="text-xs font-bold tracking-wider text-muted">授業の日程調整</p>
      </div>
      {children}
    </main>
  );
}
