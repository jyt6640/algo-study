"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LANGS = ["Java", "Python", "C++", "JavaScript", "TypeScript", "C", "C#", "Kotlin", "Swift", "Go", "Rust"];

export function ManualSolveForm({ groupId }: { groupId: number }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("Java");
  const [difficulty, setDifficulty] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/manual-solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          code: code || undefined,
          language: code ? language : undefined,
          difficulty: difficulty.trim() || undefined,
          // 날짜만 고른 경우 그 날 정오로 기록 (타임존 경계 문제 방지)
          acceptedAt: date ? new Date(`${date}T12:00:00`).toISOString() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(`/groups/${groupId}`);
        router.refresh();
      } else {
        setError(data.error || "저장에 실패했어요.");
        setBusy(false);
      }
    } catch {
      setError("네트워크 오류로 저장하지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div>
        <label className="text-sm font-semibold">문제 제목 *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 240))}
          placeholder="예: 이것이 코딩테스트다 - 떡볶이 떡 만들기"
          className="input mt-2"
        />
        <p className="mt-1 text-xs text-secondary">같은 제목으로 다시 저장하면 기존 기록이 갱신돼요.</p>
      </div>

      <div>
        <label className="text-sm font-semibold">문제 내용</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 20000))}
          rows={7}
          placeholder="문제 지문을 붙여넣거나 요약해서 적어주세요. (선택)"
          className="input mt-2 resize-y"
          style={{ fontFamily: "inherit" }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-semibold">언어</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input mt-2">
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold">난이도 (선택)</label>
          <input
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value.slice(0, 80))}
            placeholder="예: 중, Lv.2"
            className="input mt-2"
          />
        </div>
        <div>
          <label className="text-sm font-semibold">푼 날짜</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-2" />
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold">코드</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={14}
          placeholder="정답 코드를 붙여넣으세요. (선택)"
          className="input mt-2 resize-y"
          style={{ fontFamily: "var(--mono)", fontSize: "13px" }}
          spellCheck={false}
        />
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={busy || !title.trim()} className="btn btn-primary" style={{ opacity: busy || !title.trim() ? 0.5 : 1 }}>
          {busy ? "저장 중…" : "추가하기"}
        </button>
        <span className="text-xs text-secondary">추가하면 이번 기간 목표 개수에 반영돼요.</span>
      </div>
    </div>
  );
}
