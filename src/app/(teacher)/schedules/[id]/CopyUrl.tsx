"use client";

import { useState } from "react";

export function CopyUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("コピーしてください", url);
    }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ url, title: "授業の日程調整" }); } catch { /* cancelled */ }
    } else copy();
  };
  return (
    <div className="flex gap-2">
      <input readOnly value={url} className="input min-w-0 flex-1 text-sm" onFocus={(e) => e.target.select()} />
      <button type="button" onClick={copy} className="btn-primary shrink-0 px-4 py-2 text-sm">{copied ? "コピー済" : "コピー"}</button>
      <button type="button" onClick={share} className="btn-ghost shrink-0 px-3 py-2 text-sm" aria-label="共有">送る</button>
    </div>
  );
}
