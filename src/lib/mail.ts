import nodemailer from "nodemailer";

/** tutoloop01@gmail.com から通知メールを送る。設定が無ければログだけ出して続行する。 */
export async function sendMail(opts: {
  to: string[];
  subject: string;
  text: string;
}) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = Array.from(new Set(opts.to.filter(Boolean)));
  if (!user || !pass) {
    console.warn("[mail] GMAIL_USER / GMAIL_APP_PASSWORD 未設定のため送信スキップ", {
      to,
      subject: opts.subject,
    });
    return;
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  try {
    await transporter.sendMail({
      from: `TUTOLOOP 日程調整 <${user}>`,
      to,
      subject: opts.subject,
      text: opts.text,
    });
  } catch (e) {
    console.error("[mail] 送信失敗", e);
  }
}

export function notifyRecipients(teacherEmail: string) {
  return [teacherEmail, process.env.MASTER_EMAIL ?? ""];
}
