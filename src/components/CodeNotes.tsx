"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { MarkdownEditor } from "./MarkdownEditor";

type LineNote = { line: number; body: string; isPublic: boolean };
type SharedNote = { body: string; author: string; image?: string | null };
type SharedLineNote = { line: number; body: string; author: string };

function PublicToggle({
  value,
  onChange,
  size = "sm",
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  size?: "sm" | "xs";
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`rounded-full border font-medium ${size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}
      style={
        value
          ? {
              borderColor: "transparent",
              background: "color-mix(in srgb, var(--accent) 16%, transparent)",
              color: "var(--accent)",
            }
          : { borderColor: "var(--border)", color: "var(--text-secondary)" }
      }
      title={value ? "같은 스터디 멤버에게 보여요" : "나만 볼 수 있어요"}
    >
      {value ? "🌐 스터디 공개" : "🔒 나만 보기"}
    </button>
  );
}

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
  const [notePublic, setNotePublic] = useState(false);
  const [lineNotes, setLineNotes] = useState<Map<number, LineNote>>(new Map());
  const [shared, setShared] = useState<{ note: SharedNote[]; lineNotes: SharedLineNote[] }>({
    note: [],
    lineNotes: [],
  });
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [draftPublic, setDraftPublic] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/solves/${solveId}/notes`)
      .then((r) => r.json())
      .then(
        (d: {
          note: string | null;
          isPublic: boolean;
          lineNotes: LineNote[];
          shared?: { note: SharedNote[]; lineNotes: SharedLineNote[] };
        }) => {
          if (!alive) return;
          setNote(d.note ?? "");
          setNotePublic(Boolean(d.isPublic));
          setLineNotes(new Map((d.lineNotes ?? []).map((n) => [n.line, n])));
          setShared(d.shared ?? { note: [], lineNotes: [] });
          setLoaded(true);
        },
      )
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, [solveId]);

  async function persist(body: string, isPublic: boolean, line?: number) {
    const res = await fetch(`/api/solves/${solveId}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(line ? { line, body, isPublic } : { body, isPublic }),
    });
    if (res.ok) setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    return res.ok;
  }

  function onNoteChange(value: string) {
    setNote(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(value, notePublic), 800);
  }

  function onNotePublicChange(next: boolean) {
    setNotePublic(next);
    if (note.trim()) persist(note, next);
  }

  function openLine(line: number) {
    if (!canEdit) return;
    const existing = lineNotes.get(line);
    setActiveLine(line);
    setDraft(existing?.body ?? "");
    setDraftPublic(existing?.isPublic ?? false);
  }

  async function saveLine() {
    if (activeLine === null) return;
    const body = draft.trim();
    const ok = await persist(body, draftPublic, activeLine);
    if (!ok) return;
    setLineNotes((prev) => {
      const next = new Map(prev);
      if (body) next.set(activeLine, { line: activeLine, body, isPublic: draftPublic });
      else next.delete(activeLine);
      return next;
    });
    setActiveLine(null);
  }

  async function deleteLine(line: number) {
    if (!confirm(`${line}번 줄 메모를 삭제할까요?`)) return;
    const res = await fetch(`/api/solves/${solveId}/notes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line }),
    });
    if (!res.ok) {
      alert("메모를 삭제하지 못했어요.");
      return;
    }
    setLineNotes((prev) => {
      const next = new Map(prev);
      next.delete(line);
      return next;
    });
    if (activeLine === line) setActiveLine(null);
  }

  async function clearNote() {
    if (!confirm("메모장을 비울까요?")) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const ok = await persist("", notePublic);
    if (ok) setNote("");
  }

  // 줄별 공개 메모(다른 멤버)
  const sharedByLine = new Map<number, SharedLineNote[]>();
  for (const s of shared.lineNotes) {
    if (!sharedByLine.has(s.line)) sharedByLine.set(s.line, []);
    sharedByLine.get(s.line)!.push(s);
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
            const mine = lineNotes.get(line);
            const others = sharedByLine.get(line) ?? [];
            const has = Boolean(mine) || others.length > 0;
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
                  <div
                    className="mx-3 my-2 rounded-xl border p-3"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
                    <div className="mb-2 text-xs text-secondary">{line}번 줄 메모</div>
                    <MarkdownEditor
                      value={draft}
                      onChange={setDraft}
                      rows={3}
                      maxLength={10000}
                      compact
                      placeholder="이 줄에 대한 메모… (마크다운 지원)"
                      right={<PublicToggle value={draftPublic} onChange={setDraftPublic} size="xs" />}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {mine ? (
                        <button
                          onClick={() => deleteLine(line)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium"
                          style={{ color: "var(--danger)" }}
                        >
                          삭제
                        </button>
                      ) : (
                        <span />
                      )}
                      <div className="flex gap-2">
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
                  </div>
                )}

                {/* 내 라인 메모 */}
                {mine && !isActive && (
                  <div
                    className="mx-3 my-1 rounded-lg px-3 py-2 text-xs"
                    style={{ background: "var(--surface-2)", color: "var(--text)", fontFamily: "inherit" }}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[11px]">
                      <span style={{ color: "var(--warning)" }}>✎ {line}번 줄</span>
                      {mine.isPublic && <span style={{ color: "var(--accent)" }}>🌐 공개</span>}
                      {canEdit && (
                        <span className="ml-auto flex gap-1.5">
                          <button onClick={() => openLine(line)} className="hover:underline" style={{ color: "var(--text-secondary)" }}>
                            수정
                          </button>
                          <button onClick={() => deleteLine(line)} className="hover:underline" style={{ color: "var(--danger)" }}>
                            삭제
                          </button>
                        </span>
                      )}
                    </div>
                    <Markdown compact>{mine.body}</Markdown>
                  </div>
                )}

                {/* 다른 멤버의 공개 라인 메모 */}
                {others.map((o, idx) => (
                  <div
                    key={`${line}-${idx}`}
                    className="mx-3 my-1 rounded-lg px-3 py-2 text-xs"
                    style={{
                      background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                      color: "var(--text)",
                      fontFamily: "inherit",
                    }}
                  >
                    <div className="mb-1 text-[11px] font-medium" style={{ color: "var(--accent)" }}>
                      {o.author}
                    </div>
                    <Markdown compact>{o.body}</Markdown>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* 메모장 */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">📝 메모장</span>
              {canEdit && note.trim() && (
                <button onClick={clearNote} className="text-[11px] hover:underline" style={{ color: "var(--danger)" }}>
                  비우기
                </button>
              )}
            </div>
            {canEdit && <PublicToggle value={notePublic} onChange={onNotePublicChange} />}
          </div>
          <p className="mt-1 text-xs text-secondary">
            {notePublic ? "같은 스터디 멤버가 볼 수 있어요." : "나만 보여요."} 자동 저장됩니다.
            {savedAt && <span className="ml-1">· {savedAt} 저장됨</span>}
          </p>
          {canEdit ? (
            <div className="mt-3">
              <MarkdownEditor
                value={note}
                onChange={onNoteChange}
                rows={12}
                maxLength={10000}
                disabled={!loaded}
                compact
                placeholder={
                  loaded
                    ? "## 아이디어\n- 투 포인터로 O(n)\n\n## 막혔던 부분\n`while` 조건에서 경계 처리"
                    : "불러오는 중…"
                }
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-secondary">로그인하면 메모를 쓸 수 있어요.</p>
          )}
        </div>

        {/* 다른 멤버가 공개한 메모 */}
        {shared.note.length > 0 && (
          <div className="card p-5">
            <div className="text-sm font-semibold">스터디 멤버 메모</div>
            <div className="mt-3 space-y-3">
              {shared.note.map((s, i) => (
                <div key={i} className="rounded-xl p-3 text-sm" style={{ background: "var(--surface-2)" }}>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--accent)" }}>
                    {s.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" className="h-4 w-4 rounded-full" />
                    )}
                    {s.author}
                  </div>
                  <Markdown compact>{s.body}</Markdown>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
