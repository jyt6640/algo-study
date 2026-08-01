"use client";

import { useEffect, useRef, useState } from "react";

type LineNote = { line: number; body: string };

export function CodeNotes({
  solveId,
  lines,
  language,
  canEdit,
}: {
  solveId: number;
  lines: string[]; // 하이라이트된 줄별 HTML
  language?: string | null;
  canEdit: boolean; // 로그인 여부
}) {
  const [note, setNote] = useState("");
  const [lineNotes, setLineNotes] = useState<Map<number, string>>(new Map());
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/solves/${solveId}/notes`)
      .then((r) => r.json())
      .then((d: { note: string | null; lineNotes: LineNote[] }) => {
        if (!alive) return;
        setNote(d.note ?? "");
        setLineNotes(new Map((d.lineNotes ?? []).map((n) => [n.line, n.body])));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, [solveId]);

  async function persist(body: string, line?: number) {
    const res = await fetch(`/api/solves/${solveId}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(line ? { line, body } : { body }),
    });
    if (res.ok) setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    return res.ok;
  }

  // 풀이 메모: 입력이 멈추면 자동 저장
  function onNoteChange(value: string) {
    setNote(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(value), 800);
  }

  function openLine(line: number) {
    if (!canEdit) return;
    setActiveLine(line);
    setDraft(lineNotes.get(line) ?? "");
  }

  async function saveLine() {
    if (activeLine === null) return;
    const body = draft.trim();
    const ok = await persist(body, activeLine);
    if (!ok) return;
    setLineNotes((prev) => {
      const next = new Map(prev);
      if (body) next.set(activeLine, body);
      else next.delete(activeLine);
      return next;
    });
    setActiveLine(null);
  }

  const noteCount = lineNotes.size;

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* 코드 */}
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">
            정답 코드 {language ? <span className="text-secondary">({language})</span> : null}
          </div>
          {canEdit && (
            <span className="text-xs text-secondary">
              줄을 클릭해 메모{noteCount > 0 ? ` · ${noteCount}개` : ""}
            </span>
          )}
        </div>

        <div
          className="hljs overflow-x-auto rounded-2xl py-3 text-sm leading-relaxed"
          style={{ fontFamily: "var(--mono)" }}
        >
          {lines.map((html, i) => {
            const line = i + 1;
            const has = lineNotes.has(line);
            const isActive = activeLine === line;
            return (
              <div key={line}>
                <div
                  onClick={() => openLine(line)}
                  className={`group flex gap-3 px-3 ${canEdit ? "cursor-pointer" : ""}`}
                  style={{
                    background: isActive
                      ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                      : has
                        ? "color-mix(in srgb, var(--warning) 12%, transparent)"
                        : undefined,
                  }}
                >
                  <span
                    className="w-8 shrink-0 select-none text-right text-xs"
                    style={{ color: "var(--text-secondary)", opacity: 0.7, lineHeight: "1.625rem" }}
                  >
                    {has ? "✎" : line}
                  </span>
                  <code
                    className="whitespace-pre"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: html || " " }}
                  />
                </div>

                {/* 라인 메모 편집기 */}
                {isActive && (
                  <div className="mx-3 my-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <div className="mb-2 text-xs text-secondary">{line}번 줄 메모</div>
                    <textarea
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value.slice(0, 10000))}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setActiveLine(null);
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveLine();
                      }}
                      rows={3}
                      placeholder="이 줄에 대한 메모… (⌘/Ctrl+Enter 저장, Esc 닫기)"
                      className="input resize-y text-sm"
                      style={{ fontFamily: "inherit" }}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => setActiveLine(null)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium"
                        style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                      >
                        닫기
                      </button>
                      <button onClick={saveLine} className="btn btn-primary !px-3 !py-1.5 text-xs">
                        저장
                      </button>
                    </div>
                  </div>
                )}

                {/* 저장된 라인 메모 표시 */}
                {has && !isActive && (
                  <div
                    onClick={() => openLine(line)}
                    className={`mx-3 my-1 rounded-lg px-3 py-2 text-xs ${canEdit ? "cursor-pointer" : ""}`}
                    style={{ background: "var(--surface-2)", color: "var(--text)", fontFamily: "var(--sans, inherit)" }}
                  >
                    <span className="mr-1.5" style={{ color: "var(--warning)" }}>
                      ✎ {line}
                    </span>
                    <span className="whitespace-pre-wrap">{lineNotes.get(line)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 메모장 */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">📝 메모장</div>
            {savedAt && <span className="text-xs text-secondary">{savedAt} 저장됨</span>}
          </div>
          <p className="mt-0.5 text-xs text-secondary">나만 보여요. 자동 저장됩니다.</p>
          {canEdit ? (
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value.slice(0, 10000))}
              rows={14}
              disabled={!loaded}
              placeholder={loaded ? "풀이 아이디어, 시간복잡도, 막혔던 부분…" : "불러오는 중…"}
              className="input mt-3 resize-y text-sm"
              style={{ fontFamily: "inherit" }}
            />
          ) : (
            <p className="mt-3 text-sm text-secondary">로그인하면 메모를 쓸 수 있어요.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
