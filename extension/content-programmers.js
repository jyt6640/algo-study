// 프로그래머스 문제 페이지: "스터디 업로드" 버튼 + 코드 캡처 + 채점 통과 감지.

const s = document.createElement("script");
s.src = chrome.runtime.getURL("inject-programmers.js");
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

let lastPassed = null; // { lessonId, at }

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

window.addEventListener("message", (ev) => {
  if (ev.source !== window || ev.data?.type !== "ALGOSTUDY_PG_RESULT") return;
  if (ev.data.passed) {
    lastPassed = { lessonId: currentLesson(), at: new Date().toISOString() };
    const btn = document.getElementById("algostudy-btn");
    if (btn) {
      btn.textContent = "✅ 통과 — 업로드";
      btn.style.background = "#22c55e";
    }
  }
});

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

  chrome.runtime.sendMessage(
    {
      type: "ALGOSTUDY_INGEST",
      payload: {
        platform: "PROGRAMMERS",
        problemSlug: lessonId,
        problemTitle: problemTitle(),
        language,
        code,
        acceptedAt: (passed && lastPassed.at) || new Date().toISOString(),
      },
    },
    (res) => {
      btn.disabled = false;
      btn.textContent = prev;
      if (res?.ok) toast(res.isNew ? "업로드 완료 ✓" : "코드 업데이트 완료 ✓");
      else toast(res?.error || "업로드 실패", true);
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
  }
  mountButton();
}, 1500);

mountButton();
