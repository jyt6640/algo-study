// 페이지 컨텍스트에서 실행.
// 역할 1) content script 가 요청하면 Monaco 에디터의 현재 코드를 읽어 돌려준다.
// 역할 2) LeetCode 제출 결과 API(/submissions/detail/<id>/check/)를 가로채 Accepted 를 감지한다.
(function () {
  // --- 역할 1: 코드 캡처 요청 처리 ---
  window.addEventListener("message", (ev) => {
    if (ev.source !== window || ev.data?.type !== "ALGOSTUDY_CAPTURE_REQUEST") return;
    let code = "";
    let language = "";
    try {
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

  // --- 역할 2: 제출 결과 인터셉트 ---
  function handleCheckPayload(json) {
    if (!json || json.state !== "SUCCESS") return;
    const accepted = json.status_msg === "Accepted" || json.status_code === 10;
    // Accepted 시점에 에디터 코드를 함께 캡처해 자동 업로드에 쓴다
    let code = "";
    try {
      const monaco = window.monaco;
      if (monaco?.editor) {
        const models = monaco.editor.getModels();
        if (models.length) code = models[0].getValue();
      }
    } catch (e) {
      /* noop */
    }
    window.postMessage(
      {
        type: "ALGOSTUDY_SUBMIT_RESULT",
        accepted,
        statusMsg: json.status_msg || "",
        language: json.pretty_lang || json.lang || "",
        code,
      },
      "*",
    );
  }

  const isCheckUrl = (url) => typeof url === "string" && /\/submissions\/detail\/\d+\/check\/?/.test(url);

  // fetch 래핑
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (isCheckUrl(url)) {
        res
          .clone()
          .json()
          .then(handleCheckPayload)
          .catch(() => {});
      }
    } catch (e) {
      /* noop */
    }
    return res;
  };

  // XHR 래핑 (LeetCode 가 XHR 로 폴링하는 경우 대비)
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__algostudyUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        if (isCheckUrl(this.__algostudyUrl)) handleCheckPayload(JSON.parse(this.responseText));
      } catch (e) {
        /* noop */
      }
    });
    return origSend.apply(this, args);
  };
})();
