// LeetCode 문제 페이지에 "스터디 업로드" 버튼을 띄우고, 클릭 시 코드를 캡처해 배경으로 전달한다.
// inject.js 가 제출 결과를 가로채 Accepted 를 알려주면 버튼 상태를 바꾼다.

// 1) 페이지 컨텍스트 스크립트 주입 (monaco 접근 + 제출 인터셉트용)
const s = document.createElement("script");
s.src = chrome.runtime.getURL("inject.js");
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

// 문제별로 최근 Accepted 여부를 기억
let lastAccepted = null; // { slug, language, at }

function currentSlug() {
  const m = location.pathname.match(/\/problems\/([^/]+)/);
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

// inject.js 의 제출 결과 수신
window.addEventListener("message", (ev) => {
  if (ev.source !== window || ev.data?.type !== "ALGOSTUDY_SUBMIT_RESULT") return;
  const btn = document.getElementById("algostudy-btn");
  if (ev.data.accepted) {
    lastAccepted = { slug: currentSlug(), language: ev.data.language, at: new Date().toISOString() };
    if (btn) {
      btn.textContent = "✅ Accepted — 업로드";
      btn.style.background = "#22c55e";
      btn.classList.add("algostudy-pulse");
    }
  } else if (btn) {
    btn.textContent = `❌ ${ev.data.statusMsg || "실패"} — 그래도 업로드`;
    btn.style.background = "#6b7280";
  }
});

async function doUpload(btn) {
  const slug = currentSlug();
  if (!slug) return toast("문제 페이지가 아닙니다", true);

  const accepted = lastAccepted && lastAccepted.slug === slug;
  if (!accepted && !confirm("이 문제의 Accepted 를 감지하지 못했어요. 그래도 업로드할까요?")) return;

  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "업로드 중…";
  const { code, language } = await captureCode();

  chrome.runtime.sendMessage(
    {
      type: "ALGOSTUDY_INGEST",
      payload: {
        problemSlug: slug,
        problemTitle: document.title.replace(/ - LeetCode.*$/, "").trim(),
        language: language || lastAccepted?.language || "",
        code,
        acceptedAt: (accepted && lastAccepted.at) || new Date().toISOString(),
      },
    },
    (res) => {
      btn.disabled = false;
      btn.textContent = prev;
      if (res?.ok) toast(res.deduped ? "이미 제출된 문제예요" : "업로드 완료 ✓");
      else toast(res?.error || "업로드 실패", true);
    },
  );
}

function mountButton() {
  if (document.getElementById("algostudy-btn")) return;
  if (!document.body) return;

  const style = document.createElement("style");
  style.textContent =
    "@keyframes algostudy-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}.algostudy-pulse{animation:algostudy-pulse 1s ease-in-out 2}";
  document.head.appendChild(style);

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

// SPA 라우팅 대비: 경로가 바뀌면 accepted 상태 초기화 + 버튼 보장
let lastPath = location.pathname;
setInterval(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    lastAccepted = null;
  }
  mountButton();
}, 1500);

mountButton();
