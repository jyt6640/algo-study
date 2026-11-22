"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ExtensionReply = {
  readonly problems?: readonly unknown[];
  readonly error?: string;
};

class ImportCodeError extends Error {}

// 웹에서 "내 LeetCode 코드 가져오기". 설치된 확장(bridge)이 LeetCode 세션으로 코드를 가져오고,
// 이 페이지가 자기 세션으로 서버에 저장한다.
export function ImportCode({ problemSlug }: { readonly problemSlug?: string } = {}) {
  const router = useRouter();
  const [hasExt, setHasExt] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const resolver = useRef<((data: ExtensionReply) => void) | null>(null);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.source !== window || !ev.data) return;
      if (ev.data.type === "ALGOSTUDY_PONG") setHasExt(true);
      if (ev.data.type === "ALGOSTUDY_LEETCODE_DATA" && resolver.current) {
        const { problems, error } = ev.data;
        resolver.current({
          problems: Array.isArray(problems) ? problems : undefined,
          error: typeof error === "string" ? error : undefined,
        });
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
    setMsg(null);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const data = await new Promise<ExtensionReply>((resolve, reject) => {
        resolver.current = resolve;
        timeout = setTimeout(() => reject(new ImportCodeError("확장 응답이 없어요. 새로고침 후 다시 시도해 주세요.")), 60_000);
        window.postMessage({ type: "ALGOSTUDY_FETCH_LEETCODE" }, window.location.origin);
      });
      if (data.error) throw new ImportCodeError(data.error);
      let problems = data.problems ?? [];
      if (problemSlug) {
        const { findLeetCodeCode } = await import("@/lib/leetcodeImport");
        const submission = findLeetCodeCode(problems, problemSlug);
        if (!submission) {
          setMsg("최근 정답 제출에서 이 문제의 코드를 가져오지 못했어요. 아래에 직접 저장할 수 있어요.");
          return;
        }
        problems = [submission];
      } else if (problems.length === 0) {
        setMsg("가져올 최근 정답 제출이 없어요.");
        return;
      }
      const res = await fetch("/api/import/leetcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problems }),
      });
      const out: unknown = await res.json();
      if (typeof out !== "object" || out === null) {
        throw new ImportCodeError("저장 결과를 확인하지 못했어요.");
      }
      if (!res.ok) {
        const error = "error" in out && typeof out.error === "string" ? out.error : "저장에 실패했어요.";
        throw new ImportCodeError(error);
      }
      if (!("withCode" in out && typeof out.withCode === "number" && "received" in out && typeof out.received === "number")) {
        throw new ImportCodeError("저장 결과를 확인하지 못했어요.");
      }
      if (problemSlug && out.withCode !== 1) {
        setMsg("코드를 저장하지 못했어요. 풀이가 여전히 등록되어 있는지 확인해 주세요.");
        return;
      }
      setMsg(problemSlug ? "코드를 저장했어요." : `${out.received}개 반영 (코드 ${out.withCode}개)`);
      router.refresh();
    } catch (e) {
      setMsg("실패: " + (e instanceof Error ? e.message : "오류"));
    } finally {
      clearTimeout(timeout);
      resolver.current = null;
      setBusy(false);
    }
  }

  if (hasExt === false) {
    return (
      <p className="text-xs text-secondary">
        코드를 가져오려면{" "}
        <a
          href="https://chromewebstore.google.com/detail/khkdmmojedhfebdolbfkdgkldeiabafe"
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
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={importNow} disabled={busy || !hasExt} className="btn btn-secondary !px-4 !py-1.5 text-sm">
        {busy ? "가져오는 중…" : problemSlug ? "이 문제의 LeetCode 코드 가져오기" : "내 LeetCode 코드 가져오기"}
      </button>
      {msg && <span role="status" className="text-xs text-secondary">{msg}</span>}
    </div>
  );
}
