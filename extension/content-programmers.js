// 프로그래머스 문제 페이지: "스터디 업로드" 버튼 + 코드 캡처 + 채점 통과 감지.

const s = document.createElement("script");
s.src = chrome.runtime.getURL("inject-programmers.js");
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

let lastPassed = null; // { lessonId, at }
let submitSnapshot = null; // 제출 클릭 순간 캡처한 코드 { lessonId, code, language }

// "제출 후 채점하기" 를 누르는 순간의 코드를 스냅샷 (통과 시 이걸 업로드)
document.addEventListener(
  "click",
  (e) => {
    const t = e.target && e.target.closest && e.target.closest("#submit-code");
    if (!t) return;
    const lesson = currentLesson();
    captureCode().then(({ code, language }) => {
      if (code) submitSnapshot = { lessonId: lesson, code, language };
    });
  },
  true,
);

function currentLesson() {
  const m = location.pathname.match(/\/learn\/courses\/\d+\/lessons\/(\d+)/);
  return m ? m[1] : null;
}

function problemTitle() {
  return document.title
    .replace(/\s*\|\s*프로그래머스.*$/, "")
    .replace(/^코딩테스트 연습\s*-\s*/, "")
    .trim();
}

function captureCode() {
  return new Promise((resolve) => {
    const onMsg = (ev) => {
      if (ev.source !== window || ev.data?.type !== "ALGOSTUDY_PG_CAPTURE_RESULT") return;
      window.removeEventListener("message", onMsg);
      resolve({ code: ev.data.code || "", language: ev.data.language || "" });
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ type: "ALGOSTUDY_PG_CAPTURE_REQUEST" }, "*");
    setTimeout(() => {
      window.removeEventListener("message", onMsg);
      resolve({ code: "", language: "" });
    }, 1500);
  });
}

// 채점 통과를 DOM 으로 감지 (프로그래머스는 WebSocket 채점이라 네트워크로는 안 잡힘).
// 신호: "정답입니다!" 모달 또는 결과 콘솔의 "합계: X / X" 만점.
function looksPassed() {
  for (const t of document.querySelectorAll(".modal-title")) {
    if (t.textContent.trim() === "정답입니다!") return true;
  }
  for (const m of document.querySelectorAll(".console-message")) {
    const mm = m.textContent.match(/합계\s*:\s*([\d.]+)\s*\/\s*([\d.]+)/);
    if (mm && parseFloat(mm[2]) > 0 && parseFloat(mm[1]) >= parseFloat(mm[2])) return true;
  }
  return false;
}

let autoUploadedFor = null; // 자동 업로드 중복 방지 (lessonId)

function markPassed() {
  const lesson = currentLesson();
  lastPassed = { lessonId: lesson, at: new Date().toISOString() };
  const btn = document.getElementById("algostudy-btn");
  if (btn) {
    btn.textContent = "✅ 통과 — 업로드됨";
    btn.style.background = "#22c55e";
  }
  if (lesson && autoUploadedFor !== lesson) autoUpload(lesson);
}

// 통과 감지되면 버튼 없이 자동으로 코드까지 업로드 (설정 안 됐으면 조용히 스킵)
async function autoUpload(lesson) {
  autoUploadedFor = lesson;
  const cfg = await chrome.storage.local.get(["apiBase", "token"]);
  if (!cfg.apiBase || !cfg.token) {
    autoUploadedFor = null;
    return;
  }
  // 제출 순간 스냅샷 우선, 없으면 현재 에디터
  let code = "";
  let language = "";
  if (submitSnapshot && submitSnapshot.lessonId === lesson) {
    code = submitSnapshot.code;
    language = submitSnapshot.language;
  } else {
    const c = await captureCode();
    code = c.code;
    language = c.language;
  }
  sendIngest(
    {
      platform: "PROGRAMMERS",
      problemSlug: lesson,
      problemTitle: problemTitle(),
      language,
      code,
      acceptedAt: (lastPassed && lastPassed.at) || new Date().toISOString(),
    },
    (res, err) => {
      if (res?.ok) toast(res.isNew ? "자동 업로드 ✓" : "코드 업데이트 ✓");
      else {
        autoUploadedFor = null;
        if (err) toast(err, true);
      }
    },
  );
}

// 배경으로 업로드 요청 — 확장 업데이트/무응답/lastError 처리 (콜백 반드시 1회)
function sendIngest(payload, done) {
  let settled = false;
  const finish = (res, err) => {
    if (settled) return;
    settled = true;
    done(res, err);
  };
  try {
    chrome.runtime.sendMessage({ type: "ALGOSTUDY_INGEST", payload }, (res) => {
      if (chrome.runtime.lastError) return finish(null, "확장을 새로고침했어요. 문제 페이지를 새로고침해 주세요.");
      finish(res);
    });
  } catch (e) {
    finish(null, "확장이 업데이트됨 — 문제 페이지를 새로고침하세요.");
  }
  setTimeout(() => finish(null, "응답이 없어요. API 주소·토큰·네트워크를 확인하세요."), 15000);
}

const passObserver = new MutationObserver(() => {
  if (looksPassed()) markPassed();
});
if (document.body) passObserver.observe(document.body, { childList: true, subtree: true });

async function doUpload(btn) {
  const lessonId = currentLesson();
  if (!lessonId) return toast("문제 페이지가 아닙니다", true);

  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "확인 중…";

  let passed = Boolean(lastPassed && lastPassed.lessonId === lessonId);
  if (!passed) {
    btn.disabled = false;
    btn.textContent = prev;
    if (!confirm("채점 통과를 감지하지 못했어요. 정답으로 통과한 코드면 업로드할까요?")) return;
    btn.disabled = true;
  }

  btn.textContent = "업로드 중…";
  const { code, language } = await captureCode();

  sendIngest(
    {
      platform: "PROGRAMMERS",
      problemSlug: lessonId,
      problemTitle: problemTitle(),
      language,
      code,
      acceptedAt: (passed && lastPassed.at) || new Date().toISOString(),
    },
    (res, err) => {
      btn.disabled = false;
      btn.textContent = prev;
      if (res?.ok) toast(res.isNew ? "업로드 완료 ✓" : "코드 업데이트 완료 ✓");
      else toast(err || res?.error || "업로드 실패", true);
    },
  );
}

function mountButton() {
  if (document.getElementById("algostudy-btn")) return;
  if (!document.body) return;

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

let lastPath = location.pathname;
setInterval(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    lastPassed = null;
    autoUploadedFor = null;
    submitSnapshot = null;
  }
  mountButton();
}, 1500);

mountButton();
