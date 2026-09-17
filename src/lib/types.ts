export type Profile = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
};

export type Schedule = {
  id: string;
  teacher_id: string;
  title: string;
  student_name: string;
  year_month: string;
  deadline: string;
  token: string;
  created_at: string;
};

export type Availability = {
  id: string;
  schedule_id: string;
  date: string;
  start_min: number;
  end_min: number;
};

export type Response = {
  id: string;
  schedule_id: string;
  student_name: string;
  submitted_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  schedule_id: string;
  date: string;
  start_min: number;
  end_min: number;
  original_date: string;
  original_start_min: number;
  original_end_min: number;
  status: "active" | "deleted";
  source: "student" | "teacher";
  created_at: string;
  updated_at: string;
};

export type LessonEdit = {
  id: string;
  lesson_id: string;
  schedule_id: string;
  editor_id: string | null;
  editor_email: string;
  action: "update" | "delete" | "add";
  before_date: string | null;
  before_start_min: number | null;
  before_end_min: number | null;
  after_date: string | null;
  after_start_min: number | null;
  after_end_min: number | null;
  reason: string;
  created_at: string;
};

/** 空き時間帯（クライアント側の入力用） */
export type Slot = { date: string; start_min: number; end_min: number };
