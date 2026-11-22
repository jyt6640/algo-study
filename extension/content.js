// LeetCode 문제 페이지에 "스터디 업로드" 버튼을 띄우고, 클릭 시 코드를 캡처해 배경으로 전달한다.
// inject.js 가 제출 결과를 가로채 Accepted 를 알려주면 버튼 상태를 바꾼다.

let lastAccepted = null;

function currentSlug() {
  const m = location.pathname.match(/^\/problems\/([^/]+)/);
  return m ? m[1] : null;
}

function captureCode() {
  return new Promise((resolve) => {
    const onMsg = (ev) => {
      if (ev.source !== window || ev.data?.type !== "ALGOSTUDY_CAPTURE_RESULT") return;
      window.removeEventListener("message", onMsg);
      resolve({ code: ev.data.code || "", language: ev.data.language || "" });
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ type: "ALGOSTUDY_CAPTURE_REQUEST" }, "*");
    setTimeout(() => {
      window.removeEventListener("message", onMsg);
      resolve({ code: "", language: "" });
    }, 1500);
  });
}

window.addEventListener("message", (ev) => {
  if (ev.source !== window || ev.data?.type !== "ALGOSTUDY_SUBMIT_RESULT") return;
  const { slug, submissionId, accepted, statusMsg, code, language } = ev.data;
  if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug) ||
      typeof submissionId !== "string" || !/^\d+$/.test(submissionId)) return;
  const onProblem = slug === currentSlug();
  if (onProblem) syncButton();
  const btn = onProblem ? document.getElementById("algostudy-btn") : null;
  if (accepted === true) {
    const submission = {
      slug, submissionId,
      code: typeof code === "string" ? code : "",
      language: typeof language === "string" ? language : "",
      at: new Date().toISOString(),
    };
    if (onProblem) lastAccepted = submission;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "정답 코드 업로드 중…";
    }
    uploadAccepted(submission);
  } else if (btn && !btn.disabled) {
    btn.textContent = `❌ ${statusMsg || "실패"} — 그래도 업로드`;
    btn.style.background = "#6b7280";
  }
});

function uploadAccepted(submission) {
  const { slug, submissionId, code, language, at } = submission;
  sendIngest(
    {
      problemSlug: slug,
      problemTitle: slug === currentSlug() ? document.title.replace(/ - LeetCode.*$/, "").trim() : undefined,
      language,
      code,
      acceptedAt: at,
    },
    (res, err) => {
      const saved = res?.ok && res.codeSaved === true;
      const btn = lastAccepted === submission && currentSlug() === slug
        ? document.getElementById("algostudy-btn") : null;
      if (btn) {
        btn.disabled = false;
        btn.textContent = saved ? "정답 코드 업로드됨" : "코드 업로드 다시 시도";
        btn.style.background = saved ? "#22c55e" : "#6b7280";
        if (saved) btn.classList.add("algostudy-pulse");
      }
      if (saved) toast("정답 코드를 저장했어요.");
      else toast(err || res?.error || "풀이 코드를 저장하지 못했어요.", true);
    },
    submissionId,
  );
}

// LeetCode 에 직접 물어봐서 이 문제를 최근에 Accepted 했는지 확인 (제출 결과 페이지/새로고침 대응).
async function isAcceptedRecently(slug) {
  try {
    const us = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ userStatus { username isSignedIn } }" }),
    }).then((r) => r.json());
    const username = us?.data?.userStatus?.username;
    if (!username) return false;

    const rec = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query r($u:String!){recentAcSubmissionList(username:$u,limit:20){titleSlug}}",
        variables: { u: username },
      }),
    }).then((r) => r.json());
    const list = rec?.data?.recentAcSubmissionList || [];
    return list.some((s) => s.titleSlug === slug);
  } catch {
    return false;
  }
}

async function doUpload(btn) {
  const slug = currentSlug();
  if (!slug) return toast("문제 페이지가 아닙니다", true);
  if (lastAccepted?.slug === slug) {
    btn.disabled = true;
    btn.textContent = "정답 코드 업로드 중…";
    return uploadAccepted(lastAccepted);
  }

  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "확인 중…";

  const accepted = await isAcceptedRecently(slug);

  if (!accepted) {
    btn.disabled = false;
    btn.textContent = prev;
    if (!confirm("이 문제의 Accepted 를 감지하지 못했어요. 그래도 업로드할까요?")) return;
    btn.disabled = true;
  }

  btn.textContent = "업로드 중…";
  const { code, language } = await captureCode();
  if (!code.trim()) {
    btn.disabled = false;
    btn.textContent = prev;
    return toast("에디터에서 코드를 읽지 못했어요.", true);
  }

  sendIngest(
    {
      problemSlug: slug,
      problemTitle: document.title.replace(/ - LeetCode.*$/, "").trim(),
      language,
      code,
      acceptedAt: new Date().toISOString(),
    },
    (res, err) => {
      btn.disabled = false;
      btn.textContent = prev;
      if (res?.ok && res.codeSaved === true) toast("정답 코드를 저장했어요.");
      else toast(err || res?.error || "업로드 실패", true);
    },
  );
}

// 배경으로 업로드 요청 — 확장 업데이트/무응답/lastError 를 모두 처리해 콜백이 반드시 한 번 호출됨.
function sendIngest(payload, done, leetcodeSubmissionId) {
  let settled = false;
  const timer = setTimeout(() => finish(null, "응답이 없어요. 연동 토큰과 네트워크를 확인하세요."), 15000);
  const finish = (res, err) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    done(res, err);
  };
  try {
    chrome.runtime.sendMessage({ type: "ALGOSTUDY_INGEST", payload, leetcodeSubmissionId }, (res) => {
      if (chrome.runtime.lastError) return finish(null, "확장을 새로고침했어요. 문제 페이지를 새로고침해 주세요.");
      finish(res);
    });
  } catch (e) {
    finish(null, "확장이 업데이트됨 — 문제 페이지를 새로고침하세요.");
  }
}

function mountButton() {
  if (document.getElementById("algostudy-btn")) return;
  if (!currentSlug() || !document.body || !document.head) return;

  if (!document.getElementById("algostudy-style")) {
    const style = document.createElement("style");
    style.id = "algostudy-style";
    style.textContent =
      "@keyframes algostudy-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}.algostudy-pulse{animation:algostudy-pulse 1s ease-in-out 2}";
    document.head.appendChild(style);
  }

  const btn = document.createElement("button");
  btn.id = "algostudy-btn";
  btn.textContent = "📤 스터디 업로드";
  Object.assign(btn.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "99999",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    background: "#10b981",
    color: "#052e1a",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,.3)",
  });
  btn.addEventListener("click", () => doUpload(btn));
  document.body.appendChild(btn);
}

function toast(msg, isError) {
  if (!document.body) return;
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position: "fixed",
    right: "20px",
    bottom: "66px",
    zIndex: "99999",
    padding: "8px 12px",
    borderRadius: "8px",
    background: isError ? "#ef4444" : "#1f2937",
    color: "#fff",
    fontSize: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,.3)",
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// SPA 라우팅 대비: 경로가 바뀌면 accepted 상태 초기화 + 버튼 보장
let lastSlug = currentSlug();
function syncButton() {
  const slug = currentSlug();
  if (slug !== lastSlug) {
    lastSlug = slug;
    if (lastAccepted?.slug !== slug) lastAccepted = null;
    document.getElementById("algostudy-btn")?.remove();
  }
  mountButton();
}

setInterval(syncButton, 1500);
syncButton();
if (!document.body) document.addEventListener("DOMContentLoaded", syncButton, { once: true });
