"use client";

import { useState } from "react";
import { Markdown } from "./Markdown";

/** 쓰기/미리보기 탭이 있는 마크다운 입력기 */
export function MarkdownEditor({
  value,
  onChange,
  rows = 8,
  placeholder,
  maxLength = 20000,
  disabled,
  compact,
  right,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  compact?: boolean;
  right?: React.ReactNode; // 탭 줄 오른쪽에 놓을 요소(공개 토글 등)
}) {
  const [preview, setPreview] = useState(false);

  const tab = (active: boolean) => ({
    background: active ? "var(--surface-2)" : "transparent",
    color: active ? "var(--text)" : "var(--text-secondary)",
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPreview(false)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium"
            style={tab(!preview)}
          >
            쓰기
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium"
            style={tab(preview)}
          >
            미리보기
          </button>
        </div>
        {right}
      </div>

      {preview ? (
        <div
          className="rounded-xl border px-3 py-2.5"
          style={{ borderColor: "var(--border)", minHeight: `${rows * 1.6}em`, background: "var(--surface-2)" }}
        >
          {value.trim() ? (
            <Markdown compact={compact}>{value}</Markdown>
          ) : (
            <p className="text-sm text-secondary">미리볼 내용이 없어요.</p>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          className="input resize-y text-sm"
          style={{ fontFamily: "inherit" }}
        />
      )}

      <p className="mt-1.5 text-[11px] text-secondary">
        마크다운 지원 — <code>**굵게**</code> <code>## 제목</code> <code>- 목록</code> <code>`코드`</code>{" "}
        <code>```java</code> 코드블록 <code>| 표 |</code>
      </p>
    </div>
  );
}
