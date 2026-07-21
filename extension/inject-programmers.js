// 프로그래머스 페이지 컨텍스트: CodeMirror 코드 읽기.
// (채점 결과는 WebSocket 이라 네트워크 인터셉트가 안 됨 → 통과 감지는 content script 가 DOM 으로 처리)
(function () {
  window.addEventListener("message", (ev) => {
    if (ev.source !== window || ev.data?.type !== "ALGOSTUDY_PG_CAPTURE_REQUEST") return;
    let code = "";
    let language = "";
    try {
      const cm = document.querySelector(".CodeMirror");
      if (cm && cm.CodeMirror) code = cm.CodeMirror.getValue();
      const langEl = document.querySelector(
        ".select2-selection__rendered, .editor-header select, .language-selector, [class*='language']",
      );
      language = (langEl?.textContent || "").trim().slice(0, 20);
    } catch (e) {
      /* noop */
    }
    window.postMessage({ type: "ALGOSTUDY_PG_CAPTURE_RESULT", code, language }, "*");
  });
})();
