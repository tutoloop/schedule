# TUTOLOOP 日程調整システム

家庭教師の授業日程を調整する Web アプリです。

- 講師：Googleでログイン → 空き時間を登録 → 生徒用URLを発行
- 生徒：URLを開き（ログイン不要）、90分コマを選んで回答
- 回答・編集があると講師とマスター（tutoloop01@gmail.com）にメール通知
- 授業時間管理画面で月合計・各コマの確認、理由付きの編集（変更/削除/追加）

## 技術構成

| 役割 | 使用 |
|---|---|
| フレームワーク | Next.js 16 (App Router) + Tailwind CSS v4 |
| ログイン / DB | Supabase (Google OAuth + PostgreSQL) |
| メール | Gmail SMTP (nodemailer) |
| ホスティング | Vercel |

## セットアップ

### 1. Supabase
1. プロジェクトを作成し、**SQL Editor** で `supabase/schema.sql` を実行
2. **Authentication → Providers → Google** を有効化し、Google Cloud で発行した OAuth クライアントID/シークレットを設定
   - Google 側の承認済みリダイレクトURI：`https://<project-ref>.supabase.co/auth/v1/callback`
3. **Authentication → URL Configuration** の *Redirect URLs* に以下を追加
   - `http://localhost:3000/auth/callback`
   - `https://<本番ドメイン>/auth/callback`

### 2. 環境変数
`.env.example` を `.env.local` にコピーして値を入れる。

| 変数 | 内容 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret (service_role) key ※公開厳禁 |
| `MASTER_EMAIL` | マスター管理者のメール（tutoloop01@gmail.com） |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | 通知メール送信用 Gmail とアプリパスワード |
| `NEXT_PUBLIC_SITE_URL` | 本番URL（例 `https://tutoloop-schedule.vercel.app`） |

### 3. ローカル起動
```bash
npm install
npm run dev
```
http://localhost:3000 を開く。

### 4. Vercel デプロイ
1. GitHub リポジトリを Vercel に Import
2. 上記の環境変数をすべて設定
3. デプロイ後、Supabase の Redirect URLs と Google の設定に本番ドメインを追加

## 画面
- `/login` … Googleログイン
- `/dashboard` … 日程調整一覧（マスターは全講師分、講師で絞り込み可）
- `/schedules/new` … 日程調整の作成（カレンダー + 24時間バーで空き時間設定）
- `/schedules/[id]` … 授業時間管理（URLコピー、コマの編集/削除/追加、履歴）
- `/s/[token]` … 生徒用回答ページ（ログイン不要）

## データ
すべてのDBアクセスはサーバー側（service_role）経由。各テーブルは RLS 有効・ポリシー無しのため、ブラウザから直接は読み書きできません。
