"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Profile = {
  username: string;
  realName: string | null;
  avatar: string | null;
  ranking: number | null;
  totalSolved: number;
};

const card = "card mt-6 p-6";
const input = "input";

export function MemberPanel({ groupId }: { groupId: number }) {
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    setUid(localStorage.getItem(`algostudy_uid_${groupId}`));
  }, [groupId]);

  if (!uid) {
    return (
      <section className={card}>
        <h2 className="text-lg font-semibold">내 연동</h2>
        <p className="mt-2 text-sm text-secondary">
          이 브라우저에서 그룹을 만들거나 참여한 뒤에 LeetCode 계정을 연동할 수 있어요.
        </p>
      </section>
    );
  }

  return (
    <>
      <LeetCodeLink userId={Number(uid)} />
      <ExtensionLink userId={Number(uid)} />
    </>
  );
}

function LeetCodeLink({ userId }: { userId: number }) {
  const [handle, setHandle] = useState("");
  const [linked, setLinked] = useState<string | null>(null);
  const [preview, setPreview] = useState<Profile | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "notfound" | "found" | "saving">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 현재 연동된 핸들 로드
  useEffect(() => {
    fetch(`/api/handle?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.handle) {
          setLinked(d.handle);
          setHandle(d.handle);
        }
      })
      .catch(() => {});
  }, [userId]);

  const verify = useCallback((h: string) => {
    if (!h.trim()) {
      setState("idle");
      setPreview(null);
      return;
    }
    setState("checking");
    fetch(`/api/leetcode/verify?handle=${encodeURIComponent(h.trim())}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.exists) {
          setPreview(d.profile);
          setState("found");
        } else {
          setPreview(null);
          setState("notfound");
        }
      })
      .catch(() => setState("notfound"));
  }, []);

  function onChange(v: string) {
    setHandle(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => verify(v), 500); // 디바운스
  }

  async function save() {
    if (!preview) return;
    setState("saving");
    const res = await fetch("/api/handle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, handle: preview.username }),
    });
    const d = await res.json();
    if (res.ok) {
      setLinked(d.profile.username);
      setState("found");
    } else {
      setState("notfound");
    }
  }

  const isLinkedToCurrent = linked && preview && linked === preview.username;

  return (
    <section className={card}>
      <h2 className="text-lg font-semibold">LeetCode 연동</h2>
      <p className="mt-1 text-sm text-secondary">
        LeetCode 아이디만 입력하면 자동으로 확인하고 연동해요. 확장 설치 없이도 풀이가 집계됩니다.
      </p>

      {linked && (
        <p className="mt-3 text-sm" style={{ color: "var(--success)" }}>
          현재 연동됨: <b>@{linked}</b>
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          className={input}
          value={handle}
          onChange={(e) => onChange(e.target.value)}
          placeholder="LeetCode 아이디 (예: lee_algo)"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <div className="mt-3 min-h-[52px]">
        {state === "checking" && <p className="text-sm text-secondary">확인 중…</p>}
        {state === "notfound" && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            그런 아이디가 없어요.
          </p>
        )}
        {(state === "found" || state === "saving") && preview && (
          <div
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview.avatar && (
              <img src={preview.avatar} alt="" className="h-10 w-10 rounded-full" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                @{preview.username}
                {preview.realName ? <span className="text-secondary"> · {preview.realName}</span> : null}
              </div>
              <div className="text-xs text-secondary">
                {preview.totalSolved.toLocaleString()}솔 풀이
                {preview.ranking ? ` · 랭킹 ${preview.ranking.toLocaleString()}` : ""}
              </div>
            </div>
            {isLinkedToCurrent ? (
              <span className="shrink-0 text-sm" style={{ color: "var(--success)" }}>
                연동됨 ✓
              </span>
            ) : (
              <button onClick={save} disabled={state === "saving"} className="btn btn-primary shrink-0 !px-4 !py-1.5">
                {state === "saving" ? "연동 중…" : "이 계정으로 연동"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ExtensionLink({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiBase, setApiBase] = useState("");

  useEffect(() => {
    setApiBase(window.location.origin);
  }, []);

  async function issueToken() {
    setBusy(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const d = await res.json();
      if (res.ok) setToken(d.token);
    } finally {
      setBusy(false);
    }
  }

  const copy = (t: string) => navigator.clipboard?.writeText(t);

  return (
    <section className={card}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold">확장프로그램으로 코드까지 올리기 (선택)</h2>
        <span className="text-secondary">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm text-secondary">
          <p>
            핸들 연동만으로도 풀이 개수는 자동 집계돼요. <b style={{ color: "var(--text)" }}>실제 제출 코드까지</b>{" "}
            스터디에 남기고 싶으면 확장을 설치하세요.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <code className="text-secondary">chrome://extensions</code> → 개발자 모드 → 압축해제된
              확장 로드 → <code>extension/</code> 폴더
            </li>
            <li>확장 팝업에 아래 API 주소와 연동 토큰 입력</li>
            <li>LeetCode 문제 페이지에서 Accepted 후 「📤 스터디 업로드」 클릭</li>
          </ol>

          {!token ? (
            <button onClick={issueToken} disabled={busy} className="btn btn-secondary !px-4 !py-1.5">
              {busy ? "발급 중…" : "연동 토큰 발급"}
            </button>
          ) : (
            <div className="space-y-2">
              <TokenField label="API 주소" value={apiBase} onCopy={copy} />
              <TokenField label="연동 토큰 (지금만 표시)" value={token} onCopy={copy} mono />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TokenField({
  label,
  value,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  onCopy: (t: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-secondary">{label}</div>
      <div className="flex gap-2">
        <input readOnly value={value} className={`input ${mono ? "font-mono" : ""}`} />
        <button onClick={() => onCopy(value)} className="btn btn-secondary shrink-0 !px-4 !py-2">
          복사
        </button>
      </div>
    </div>
  );
}
