"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// 웹에서 "내 LeetCode 코드 가져오기". 설치된 확장(bridge)이 LeetCode 세션으로 코드를 가져오고,
// 이 페이지가 자기 세션으로 서버에 저장한다.
export function ImportCode() {
  const router = useRouter();
  const [hasExt, setHasExt] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const resolver = useRef<((data: unknown) => void) | null>(null);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.source !== window || !ev.data) return;
      if (ev.data.type === "ALGOSTUDY_PONG") setHasExt(true);
      if (ev.data.type === "ALGOSTUDY_LEETCODE_DATA" && resolver.current) {
        resolver.current(ev.data);
        resolver.current = null;
      }
    }
    window.addEventListener("message", onMsg);
    window.postMessage({ type: "ALGOSTUDY_PING" }, "*");
    const t = setTimeout(() => setHasExt((v) => (v === null ? false : v)), 1200);
    return () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(t);
    };
  }, []);

  async function importNow() {
    setBusy(true);
    setMsg("확장에서 코드 가져오는 중…");
    try {
      const data = await new Promise<{ problems?: unknown[]; error?: string }>((resolve, reject) => {
        resolver.current = resolve as (d: unknown) => void;
        window.postMessage({ type: "ALGOSTUDY_FETCH_LEETCODE" }, "*");
        setTimeout(() => reject(new Error("확장 응답 없음")), 60000);
      });
      if (data.error) throw new Error(data.error);
      const problems = data.problems ?? [];
      setMsg(`${problems.length}개 저장 중…`);
      const res = await fetch("/api/import/leetcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problems }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "저장 실패");
      setMsg(`완료 ✓ ${out.received}개 반영 (코드 ${out.withCode}개)`);
      router.refresh();
    } catch (e) {
      setMsg("실패: " + (e instanceof Error ? e.message : "오류"));
    } finally {
      setBusy(false);
    }
  }

  if (hasExt === false) {
    return (
      <p className="text-xs text-secondary">
        코드를 가져오려면{" "}
        <a
          href="https://github.com/jyt6640/algo-study/releases"
          target="_blank"
          rel="noreferrer"
          className="accent hover:underline"
        >
          확장프로그램
        </a>
        이 필요해요.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-secondary">{msg}</span>}
      <button onClick={importNow} disabled={busy || !hasExt} className="btn btn-secondary !px-4 !py-1.5 text-sm">
        {busy ? "가져오는 중…" : "내 LeetCode 코드 가져오기"}
      </button>
    </div>
  );
}
