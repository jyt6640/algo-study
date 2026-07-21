// LeetCode 문제 페이지에 "스터디 업로드" 버튼을 띄우고, 클릭 시 코드를 캡처해 배경으로 전달한다.

// 1) 페이지 컨텍스트 스크립트 주입 (monaco 접근용)
const s = document.createElement("script");
s.src = chrome.runtime.getURL("inject.js");
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

// 2) URL 에서 문제 slug 추출: /problems/<slug>/...
function currentSlug() {
  const m = location.pathname.match(/\/problems\/([^/]+)/);
  return m ? m[1] : null;
}

// 3) 페이지에서 코드 캡처 (Promise)
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

// 4) 플로팅 버튼
function mountButton() {
  if (document.getElementById("algostudy-btn")) return;
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

  btn.addEventListener("click", async () => {
    const slug = currentSlug();
    if (!slug) return toast("문제 페이지가 아닙니다", true);
    btn.disabled = true;
    btn.textContent = "업로드 중…";
    const { code, language } = await captureCode();
    chrome.runtime.sendMessage(
      {
        type: "ALGOSTUDY_INGEST",
        payload: {
          problemSlug: slug,
          problemTitle: document.title.replace(/ - LeetCode.*$/, "").trim(),
          language,
          code,
          acceptedAt: new Date().toISOString(),
        },
      },
      (res) => {
        btn.disabled = false;
        btn.textContent = "📤 스터디 업로드";
        if (res?.ok) toast(res.deduped ? "이미 제출된 문제예요" : "업로드 완료 ✓");
        else toast(res?.error || "업로드 실패", true);
      },
    );
  });

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

mountButton();
// SPA 라우팅 대비: 주기적으로 버튼 존재 보장
setInterval(mountButton, 2000);
