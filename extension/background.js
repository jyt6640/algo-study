// 배경 서비스 워커: content script 로부터 받은 제출을 우리 백엔드 /api/ingest 로 POST 한다.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "ALGOSTUDY_INGEST") return;

  (async () => {
    const { apiBase, token } = await chrome.storage.local.get(["apiBase", "token"]);
    if (!apiBase || !token) {
      sendResponse({ ok: false, error: "확장 설정에서 API 주소와 연동 토큰을 먼저 입력하세요." });
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
