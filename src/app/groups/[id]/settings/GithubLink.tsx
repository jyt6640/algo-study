"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GithubLink({ groupId, repo, installationId }: { groupId: number; repo: string | null; installationId: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(repo ?? "");
  const [appInstallationId, setAppInstallationId] = useState(installationId ?? "");
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
        body: JSON.stringify({ mode: "existing", repo: value.trim(), installationId: appInstallationId.trim() }),
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
        GitHub App을 레포에 설치한 뒤 선택한 레포에 <b>PR 템플릿</b>과 <b>자동 라벨링</b>을 설치해요. OAuth 토큰은
        레포 작업에 사용하지 않습니다.
      </p>

      {repo && (
        <p className="mt-3 text-sm" style={{ color: "var(--success)" }}>
          연동됨:{" "}
          <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer" className="underline">
            {repo}
          </a>
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="owner/repo 또는 GitHub URL"
        />
        <button onClick={setup} disabled={busy} className="btn btn-primary shrink-0">
          {busy ? "설정 중…" : repo ? "다시 설정" : "연동"}
        </button>
      </div>
      <label className="mt-2 block text-xs text-secondary">
        GitHub App 설치 ID
        <input
          className="input mt-1"
          value={appInstallationId}
          onChange={(e) => setAppInstallationId(e.target.value)}
          placeholder="예: 12345678"
          inputMode="numeric"
        />
      </label>

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
