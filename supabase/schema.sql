-- TUTOLOOP 日程調整システム スキーマ
-- Supabase の SQL Editor にこのファイルの内容を貼り付けて実行してください。

create extension if not exists pgcrypto;

-- 講師プロフィール（Googleログイン時に自動作成）
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 日程調整（1つ = 1講師 × 1生徒 × 1ヶ月）
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  student_name text not null,
  year_month text not null,             -- 'YYYY-MM'
  deadline date not null,               -- 回答期限（この日の23:59まで有効）
  token text not null unique,           -- 生徒用URLのトークン
  created_at timestamptz not null default now()
);
create index if not exists schedules_teacher_idx on schedules(teacher_id);
create index if not exists schedules_token_idx on schedules(token);

-- 講師の空き時間帯
create table if not exists availabilities (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  date date not null,
  start_min int not null check (start_min >= 0 and start_min < 1440),
  end_min int not null check (end_min > 0 and end_min <= 1440 and end_min > start_min)
);
create index if not exists availabilities_schedule_idx on availabilities(schedule_id);

-- 生徒の回答（1日程調整につき1件）
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null unique references schedules(id) on delete cascade,
  student_name text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 確定した授業コマ
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  date date not null,
  start_min int not null,
  end_min int not null,
  original_date date not null,          -- 最初に設定された日時（編集前の表示用）
  original_start_min int not null,
  original_end_min int not null,
  status text not null default 'active' check (status in ('active','deleted')),
  source text not null default 'student' check (source in ('student','teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lessons_schedule_idx on lessons(schedule_id);
create index if not exists lessons_date_idx on lessons(date);

-- 編集履歴（理由必須）
create table if not exists lesson_edits (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  schedule_id uuid not null references schedules(id) on delete cascade,
  editor_id uuid references profiles(id) on delete set null,
  editor_email text not null,
  action text not null check (action in ('update','delete','add')),
  before_date date,
  before_start_min int,
  before_end_min int,
  after_date date,
  after_start_min int,
  after_end_min int,
  reason text not null check (length(trim(reason)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists lesson_edits_schedule_idx on lesson_edits(schedule_id);

-- すべてのアクセスはサーバー側（service_role）経由のみ。
-- RLS を有効化し、ポリシーを作らないことで anon / authenticated からの直接アクセスを遮断する。
alter table profiles enable row level security;
alter table schedules enable row level security;
alter table availabilities enable row level security;
alter table responses enable row level security;
alter table lessons enable row level security;
alter table lesson_edits enable row level security;
