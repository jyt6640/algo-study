// 페이지 컨텍스트에서 실행 — content script(격리 월드)는 window.monaco 에 접근 못 하므로 여기서 읽는다.
(function () {
  window.addEventListener("message", (ev) => {
    if (ev.source !== window || ev.data?.type !== "ALGOSTUDY_CAPTURE_REQUEST") return;

    let code = "";
    let language = "";
    try {
      // LeetCode 는 Monaco 에디터를 쓴다.
      const monaco = window.monaco;
      if (monaco?.editor) {
        const models = monaco.editor.getModels();
        if (models.length) {
          code = models[0].getValue();
          language = models[0].getLanguageId?.() ?? "";
        }
      }
    } catch (e) {
      /* noop */
    }

    window.postMessage({ type: "ALGOSTUDY_CAPTURE_RESULT", code, language }, "*");
  });
})();
