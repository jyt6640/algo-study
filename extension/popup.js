const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function init() {
  const { apiBase, token } = await chrome.storage.local.get(["apiBase", "token"]);
  if (apiBase) $("apiBase").value = apiBase;
  if (token) $("token").value = token;

  if (apiBase && token) {
    loadDashboard(apiBase, token);
  } else {
    // 설정 안 됐으면 설정 섹션을 펼쳐서 유도
    $("settingsBox").open = true;
    $("dash").innerHTML = '<div class="card"><p class="muted">연동 설정을 먼저 저장하면 여기에 내 현황이 표시돼요.</p></div>';
  }
}

async function loadDashboard(apiBase, token) {
  $("dash").innerHTML = '<div class="card"><p class="muted">불러오는 중…</p></div>';
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      $("dash").innerHTML = `<div class="card"><p class="muted">${esc(d.error || "현황을 불러오지 못했어요.")}</p></div>`;
      $("settingsBox").open = true;
      return;
    }
    const data = await res.json();
    renderDashboard(data);
  } catch (e) {
    $("dash").innerHTML = `<div class="card"><p class="muted">네트워크 오류: ${esc(e.message)}</p></div>`;
  }
}

function segBar(solved, quota) {
  let segs = "";
  for (let i = 0; i < quota; i++) segs += `<span class="seg ${i < solved ? "on" : ""}"></span>`;
  return `<div class="bar">${segs}</div>`;
}

function renderDashboard(data) {
  const handleLine = data.handle
    ? `<div class="sub">LeetCode <a href="https://leetcode.com/u/${esc(data.handle)}/" target="_blank">@${esc(data.handle)}</a></div>`
    : `<div class="sub" style="color:var(--warning)">LeetCode 미연동 — 설정에서 연동하세요</div>`;

  let studies = "";
  if (!data.studies || data.studies.length === 0) {
    studies = '<p class="muted">참여한 스터디가 없어요.</p>';
  } else {
    studies = data.studies
      .map((s) => {
        const right = s.met
          ? '<span style="color:var(--success)">✓ 달성</span>'
          : `<span style="color:var(--warning)">벌금 ${s.projectedPenalty.toLocaleString()}원</span>`;
        return `<div style="margin-bottom:10px">
          <div class="row"><b>${esc(s.name)}</b>${right}</div>
          ${segBar(s.solved, s.quota)}
          <div class="sub" style="text-align:right;margin-top:3px">${s.solved}/${s.quota}</div>
        </div>`;
      })
      .join("");
  }

  let recent = "";
  if (data.recent && data.recent.length) {
    recent = data.recent
      .slice(0, 8)
      .map(
        (r) =>
          `<div class="row"><a href="https://leetcode.com/problems/${esc(r.slug)}/" target="_blank">${esc(r.title || r.slug)}</a><span class="sub">${esc(String(r.acceptedAt).slice(0, 10))}</span></div>`,
      )
      .join("");
  } else {
    recent = '<p class="muted">아직 수집된 풀이가 없어요.</p>';
  }

  $("dash").innerHTML = `
    <div class="card">${handleLine}<div style="margin-top:10px">${studies}</div></div>
    <div class="card"><div class="sub" style="margin-bottom:6px">최근 푼 문제</div>${recent}</div>
  `;
}

$("save").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim();
  const token = $("token").value.trim();
  await chrome.storage.local.set({ apiBase, token });
  $("status").textContent = "저장됐어요 ✓";
  $("status").style.color = "var(--success)";
  if (apiBase && token) loadDashboard(apiBase, token);
  setTimeout(() => ($("status").textContent = ""), 1500);
});

$("link").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim();
  const token = $("token").value.trim();
  const set = $("linkStatus");
  set.style.color = "var(--success)";
  if (!apiBase || !token) {
    set.style.color = "var(--danger)";
    set.textContent = "API 주소와 토큰을 먼저 저장하세요.";
    return;
  }
  try {
    set.textContent = "LeetCode 로그인 확인 중…";
    const gql = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ userStatus { isSignedIn username } }" }),
    });
    const data = await gql.json();
    const status = data?.data?.userStatus;
    if (!status?.isSignedIn || !status.username) {
      set.style.color = "var(--danger)";
      set.textContent = "leetcode.com 에 로그인돼 있지 않아요.";
      return;
    }
    set.textContent = `@${status.username} 연동 중…`;
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ handle: status.username }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
    set.style.color = "var(--success)";
    set.textContent = `연동 완료 ✓ @${status.username}`;
    loadDashboard(apiBase, token);
  } catch (e) {
    set.style.color = "var(--danger)";
    set.textContent = "연동 실패: " + (e instanceof Error ? e.message : String(e));
  }
});

init();
