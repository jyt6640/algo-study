const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// API 주소는 고정 — 사용자는 토큰만 입력한다.
const API_BASE = "https://algo-study-eight.vercel.app";

// 서버 벌크 상한(100개)에 맞춰 나눠서 업로드한다. 진행 상황을 set 에 표시.
async function uploadBulkChunked(apiBase, token, platform, problems, set) {
  const CHUNK = 100;
  const base = apiBase.replace(/\/$/, "");
  const agg = { received: 0, inserted: 0, withCode: 0 };
  for (let i = 0; i < problems.length; i += CHUNK) {
    const batch = problems.slice(i, i + CHUNK);
    if (set) set.textContent = `업로드 중… ${Math.min(i + batch.length, problems.length)}/${problems.length}`;
    const res = await fetch(`${base}/api/ingest/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ platform, problems: batch }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
    agg.received += out.received || batch.length;
    agg.inserted += out.inserted || 0;
    agg.withCode += out.withCode || 0;
  }
  return agg;
}

async function init() {
  const { token } = await chrome.storage.local.get(["token"]);
  if (token) $("token").value = token;

  if (token) {
    loadDashboard(API_BASE, token);
  } else {
    // 설정 안 됐으면 설정 섹션을 펼쳐서 유도
    $("settingsBox").open = true;
    $("dash").innerHTML = '<div class="card"><p class="muted">연동 토큰을 저장하면 여기에 내 현황이 표시돼요.</p></div>';
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
  const token = $("token").value.trim();
  await chrome.storage.local.set({ token, apiBase: API_BASE });
  $("status").textContent = "저장됐어요 ✓";
  $("status").style.color = "var(--success)";
  if (token) loadDashboard(API_BASE, token);
  setTimeout(() => ($("status").textContent = ""), 1500);
});

$("link").addEventListener("click", async () => {
  const apiBase = API_BASE;
  const token = $("token").value.trim();
  const set = $("linkStatus");
  set.style.color = "var(--success)";
  if (!apiBase || !token) {
    set.style.color = "var(--danger)";
    set.textContent = "연동 토큰을 먼저 저장하세요.";
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

// 프로그래머스 "내가 푼 문제" 목록을 페이지별로 긁어 일괄 업로드
$("importPg").addEventListener("click", async () => {
  const apiBase = API_BASE;
  const token = $("token").value.trim();
  const set = $("importStatus");
  set.style.color = "var(--success)";
  if (!apiBase || !token) {
    set.style.color = "var(--danger)";
    set.textContent = "연동 토큰을 먼저 저장하세요.";
    return;
  }
  const levelLabel = { 0: "Lv.0", 1: "Lv.1", 2: "Lv.2", 3: "Lv.3", 4: "Lv.4", 5: "Lv.5" };
  try {
    const problems = [];
    let totalPages = 1;
    for (let page = 1; page <= totalPages && page <= 100; page++) {
      set.textContent = `푼 문제 수집 중… ${problems.length}개`;
      const res = await fetch(
        `https://school.programmers.co.kr/api/v2/school/challenges/?perPage=30&statuses%5B%5D=solved&order=recent&search=&page=${page}`,
        { credentials: "include", headers: { Accept: "application/json" } },
      );
      if (!res.ok) break;
      const j = await res.json();
      totalPages = j.totalPages || 1;
      for (const it of j.result || []) {
        if (!it?.id) continue;
        problems.push({
          slug: String(it.id),
          title: (it.title || "").slice(0, 120),
          acceptedAt: it.finishedAt || undefined,
          difficulty: levelLabel[it.level] || undefined,
        });
      }
    }

    if (problems.length === 0) {
      set.style.color = "var(--danger)";
      set.textContent = "가져올 문제가 없어요. programmers.co.kr 에 로그인돼 있나요?";
      return;
    }

    const out = await uploadBulkChunked(apiBase, token, "PROGRAMMERS", problems, set);
    set.style.color = "var(--success)";
    set.textContent = `완료 ✓ 총 ${out.received}개 중 ${out.inserted}개 새로 반영`;
    if (token && apiBase) loadDashboard(apiBase, token);
  } catch (e) {
    set.style.color = "var(--danger)";
    set.textContent = "실패: " + (e instanceof Error ? e.message : String(e));
  }
});

// LeetCode 세션으로 최근 Accepted 풀이의 실제 코드를 가져와 일괄 업로드
$("importLc").addEventListener("click", async () => {
  const apiBase = API_BASE;
  const token = $("token").value.trim();
  const set = $("importLcStatus");
  set.style.color = "var(--success)";
  if (!apiBase || !token) {
    set.style.color = "var(--danger)";
    set.textContent = "연동 토큰을 먼저 저장하세요.";
    return;
  }
  const gql = (query, variables) =>
    fetch("https://leetcode.com/graphql", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    }).then((r) => r.json());

  try {
    set.textContent = "LeetCode 로그인 확인 중…";
    const us = await gql("{ userStatus { isSignedIn username } }");
    const status = us?.data?.userStatus;
    if (!status?.isSignedIn || !status.username) {
      set.style.color = "var(--danger)";
      set.textContent = "leetcode.com 에 로그인돼 있지 않아요.";
      return;
    }

    set.textContent = "최근 풀이 목록 불러오는 중…";
    const rec = await gql(
      "query r($u:String!){recentAcSubmissionList(username:$u,limit:20){id title titleSlug timestamp}}",
      { u: status.username },
    );
    const list = rec?.data?.recentAcSubmissionList || [];
    if (list.length === 0) {
      set.style.color = "var(--danger)";
      set.textContent = "가져올 풀이가 없어요.";
      return;
    }

    const problems = [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      set.textContent = `코드 가져오는 중… ${i + 1}/${list.length}`;
      let code = "";
      let language = "";
      try {
        const d = await gql("query d($id:Int!){submissionDetails(submissionId:$id){code lang{name}}}", {
          id: Number(s.id),
        });
        code = d?.data?.submissionDetails?.code || "";
        language = d?.data?.submissionDetails?.lang?.name || "";
      } catch (e) {
        /* 코드 조회 실패해도 문제는 반영 */
      }
      problems.push({
        slug: s.titleSlug,
        title: s.title,
        acceptedAt: new Date(Number(s.timestamp) * 1000).toISOString(),
        code,
        language,
      });
    }

    const out = await uploadBulkChunked(apiBase, token, "LEETCODE", problems, set);
    set.style.color = "var(--success)";
    set.textContent = `완료 ✓ ${out.received}개 반영 (코드 ${out.withCode}개)`;
    loadDashboard(apiBase, token);
  } catch (e) {
    set.style.color = "var(--danger)";
    set.textContent = "실패: " + (e instanceof Error ? e.message : String(e));
  }
});

init();
