// 우리 웹앱 페이지에서 실행되는 브리지.

function fetchLeetcode() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "ALGOSTUDY_FETCH_LEETCODE" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: "확장을 새로고침했어요. 페이지를 새로고침한 뒤 다시 시도하세요." });
          return;
        }
        resolve(response || { error: "확장에서 응답을 받지 못했어요." });
      });
    } catch (error) {
      resolve({ error: error instanceof Error ? error.message : "확장과 통신하지 못했어요." });
    }
  });
}

window.addEventListener("message", async (ev) => {
  if (ev.source !== window || !ev.data) return;
  if (ev.data.type === "ALGOSTUDY_PING") {
    window.postMessage({ type: "ALGOSTUDY_PONG" }, "*");
    return;
  }
  if (ev.data.type === "ALGOSTUDY_FETCH_LEETCODE") {
    try {
      const res = await fetchLeetcode();
      window.postMessage({ type: "ALGOSTUDY_LEETCODE_DATA", ...res }, "*");
    } catch (e) {
      window.postMessage({ type: "ALGOSTUDY_LEETCODE_DATA", error: String(e) }, "*");
    }
  }
});

// 페이지가 확장 존재를 감지할 수 있게 표식
window.postMessage({ type: "ALGOSTUDY_PONG" }, "*");
