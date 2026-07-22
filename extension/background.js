// 배경 서비스 워커: content script 로부터 받은 제출을 우리 백엔드 /api/ingest 로 POST 한다.

const API_BASE = "https://algo-study-eight.vercel.app";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "ALGOSTUDY_INGEST") return;

  (async () => {
    const stored = await chrome.storage.local.get(["apiBase", "token"]);
    const apiBase = stored.apiBase || API_BASE;
    const token = stored.token;
    if (!token) {
      sendResponse({ ok: false, error: "확장 팝업에서 연동 토큰을 먼저 입력하세요." });
      return;
    }

    try {
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(msg.payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) sendResponse({ ok: false, error: data.error || `HTTP ${res.status}` });
      else sendResponse({ ok: true, ...data });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();

  return true; // async sendResponse
});
