"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Preview = {
  username: string;
  realName: string | null;
  avatar: string | null;
  ranking: number | null;
  totalSolved: number;
};

// LeetCode(검증) + 프로그래머스(자기 선언) 연동 위젯. 둘 중 하나는 반드시 연동하도록 유도.
export function PlatformLink() {
  const router = useRouter();
  const [leetcode, setLeetcode] = useState<string | null>(null);
  const [programmers, setProgrammers] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/handle")
      .then((r) => r.json())
      .then((d) => {
        setLeetcode(d.leetcode ?? null);
        setProgrammers(d.programmers ?? null);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <LeetCodeBlock linked={leetcode} onLinked={(h) => { setLeetcode(h); router.refresh(); }} />
      <ProgrammersBlock linked={programmers} onLinked={(h) => { setProgrammers(h); router.refresh(); }} />
    </div>
  );
}

function LeetCodeBlock({ linked, onLinked }: { linked: string | null; onLinked: (h: string) => void }) {
  const [handle, setHandle] = useState(linked ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "notfound" | "found" | "saving">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (linked) setHandle(linked);
  }, [linked]);

  const verify = useCallback((h: string) => {
    if (!h.trim()) return setState("idle"), setPreview(null);
    setState("checking");
    fetch(`/api/leetcode/verify?handle=${encodeURIComponent(h.trim())}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.exists) setPreview(d.profile), setState("found");
        else setPreview(null), setState("notfound");
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
      body: JSON.stringify({ handle: preview.username, platform: "LEETCODE" }),
    });
    if (res.ok) {
      onLinked(preview.username);
      setState("found");
    } else setState("notfound");
  }

  const isCurrent = linked && preview && linked === preview.username;

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">LeetCode 연동</h2>
      <p className="mt-1 text-sm text-secondary">아이디만 입력하면 자동 확인 후 연동돼요.</p>
      {linked && (
        <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>
          연동됨: <b>@{linked}</b>
        </p>
      )}
      <input
        className="input mt-3"
        value={handle}
        onChange={(e) => onChange(e.target.value)}
        placeholder="LeetCode 아이디"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
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
              <div className="truncate font-medium">@{preview.username}</div>
              <div className="text-xs text-secondary">{preview.totalSolved.toLocaleString()}솔 풀이</div>
            </div>
            {isCurrent ? (
              <span className="text-sm" style={{ color: "var(--success)" }}>
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

function ProgrammersBlock({ linked, onLinked }: { linked: string | null; onLinked: (h: string) => void }) {
  const [handle, setHandle] = useState(linked ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (linked) setHandle(linked);
  }, [linked]);

  async function save() {
    if (!handle.trim()) return;
    setBusy(true);
    const res = await fetch("/api/handle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: handle.trim(), platform: "PROGRAMMERS" }),
    });
    setBusy(false);
    if (res.ok) onLinked(handle.trim());
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">프로그래머스 연동</h2>
      <p className="mt-1 text-sm text-secondary">
        프로그래머스는 공개 API가 없어 닉네임만 등록해요. 풀이는 확장프로그램으로 올리면 집계됩니다.
      </p>
      {linked && (
        <p className="mt-2 text-sm" style={{ color: "var(--success)" }}>
          연동됨: <b>{linked}</b>
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <input
          className="input"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="프로그래머스 닉네임"
        />
        <button onClick={save} disabled={busy || !handle.trim()} className="btn btn-primary shrink-0">
          {busy ? "연동 중…" : linked === handle.trim() ? "연동됨 ✓" : "연동"}
        </button>
      </div>
    </section>
  );
}
