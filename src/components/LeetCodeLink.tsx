"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  username: string;
  realName: string | null;
  avatar: string | null;
  ranking: number | null;
  totalSolved: number;
};

// 로그인 사용자의 LeetCode 연동 위젯. 세션 기반 (/api/handle, /api/leetcode/verify).
export function LeetCodeLink() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [linked, setLinked] = useState<string | null>(null);
  const [preview, setPreview] = useState<Profile | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "notfound" | "found" | "saving">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/handle")
      .then((r) => r.json())
      .then((d) => {
        if (d.handle) {
          setLinked(d.handle);
          setHandle(d.handle);
        }
      })
      .catch(() => {});
  }, []);

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
    timer.current = setTimeout(() => verify(v), 500);
  }

  async function save() {
    if (!preview) return;
    setState("saving");
    const res = await fetch("/api/handle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: preview.username }),
    });
    const d = await res.json();
    if (res.ok) {
      setLinked(d.profile.username);
      setState("found");
      router.refresh(); // 잔디/프로필 갱신
    } else {
      setState("notfound");
    }
  }

  const isLinkedToCurrent = linked && preview && linked === preview.username;

  return (
    <section className="card mt-6 p-6">
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
          className="input"
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
            {preview.avatar && <img src={preview.avatar} alt="" className="h-10 w-10 rounded-full" />}
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
