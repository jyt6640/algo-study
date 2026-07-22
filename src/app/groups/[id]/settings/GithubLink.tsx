"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function GithubLink({ groupId, repo }: { groupId: number; repo: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "existing">(repo ? "existing" : "new");
  const [value, setValue] = useState(repo ?? "");
  const [priv, setPriv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function setup() {
    if (!value.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, repo: value.trim(), private: priv }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "연동 실패");
      setMsg({ ok: true, text: `연동 완료: ${d.repo}` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "오류" });
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (!confirm("레포 연동을 해제할까요? (레포 자체는 삭제되지 않아요)")) return;
    setBusy(true);
    await fetch(`/api/groups/${groupId}/github`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">GitHub 풀이 레포</h2>
      <p className="mt-1 text-sm text-secondary">
        연동하면 레포에 <b>PR 템플릿</b>과 <b>자동 라벨링</b>(플랫폼·알고리즘·해결여부)이 설치돼요. PR을 올리면
        제목·본문·변경 폴더로 라벨이 자동으로 달립니다. <b>본인 소유(또는 push 권한) 레포</b>만 연결돼요.
      </p>
      <button
        onClick={() => signIn("github", { callbackUrl: window.location.href })}
        className="mt-3 rounded-full border px-3 py-1 text-xs text-secondary hover:bg-[var(--surface-2)]"
        style={{ borderColor: "var(--border)" }}
      >
        GitHub 레포 권한 허용 (재인증)
      </button>
      <p className="mt-1 text-xs text-secondary">
        &quot;레포 권한이 없어요&quot; 오류가 나면 위 버튼으로 재인증해 GitHub 레포 접근을 허용하세요.
      </p>

      {repo && (
        <p className="mt-3 text-sm" style={{ color: "var(--success)" }}>
          연동됨:{" "}
          <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer" className="underline">
            {repo}
          </a>
        </p>
      )}

      <div className="mt-4 flex gap-2 text-sm">
        <button
          onClick={() => setMode("new")}
          className={`rounded-full border px-3 py-1 ${mode === "new" ? "accent" : "text-secondary"}`}
          style={{ borderColor: mode === "new" ? "var(--accent)" : "var(--border)" }}
        >
          새로 만들기
        </button>
        <button
          onClick={() => setMode("existing")}
          className={`rounded-full border px-3 py-1 ${mode === "existing" ? "accent" : "text-secondary"}`}
          style={{ borderColor: mode === "existing" ? "var(--accent)" : "var(--border)" }}
        >
          기존 레포 연결
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "new" ? "새 레포 이름 (예: algorithm-study)" : "owner/repo 또는 GitHub URL"}
        />
        <button onClick={setup} disabled={busy} className="btn btn-primary shrink-0">
          {busy ? "설정 중…" : repo ? "다시 설정" : "연동"}
        </button>
      </div>
      {mode === "new" && (
        <label className="mt-2 flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> 비공개 레포로 생성
        </label>
      )}

      {msg && (
        <p className="mt-3 text-sm" style={{ color: msg.ok ? "var(--success)" : "var(--danger)" }}>
          {msg.text}
        </p>
      )}
      {repo && (
        <button onClick={unlink} disabled={busy} className="mt-3 text-xs text-secondary hover:underline">
          연동 해제
        </button>
      )}
    </section>
  );
}
