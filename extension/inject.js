// 페이지 컨텍스트에서 실행.
// 1) content script 요청 시 Monaco 코드 반환
// 2) 제출 요청(/problems/<slug>/submit/) 본문에서 실제 제출 코드(typed_code) 캡처
// 3) 제출 결과 API(/submissions/detail/<id>/check/)를 가로채 Accepted 감지 (+ 제출 코드 동봉)
(function () {
  let lastSubmitCode = "";
  let lastSubmitLang = "";

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

  const isSubmitUrl = (url) => typeof url === "string" && /\/problems\/[^/]+\/submit\/?/.test(url);
  const isCheckUrl = (url) => typeof url === "string" && /\/submissions\/detail\/\d+\/check\/?/.test(url);

  // 제출 요청 본문에서 typed_code 추출
  function grabSubmitBody(body) {
    try {
      if (typeof body !== "string") return;
      const b = JSON.parse(body);
      if (b && typeof b.typed_code === "string") {
        lastSubmitCode = b.typed_code;
        lastSubmitLang = b.lang || "";
      }
    } catch (e) {
      /* noop */
    }
  }

  // 제출 결과에서 Accepted 감지 (제출 코드 또는 에디터 코드 동봉)
  function handleCheckPayload(json) {
    if (!json || json.state !== "SUCCESS") return;
    const accepted = json.status_msg === "Accepted" || json.status_code === 10;
    let code = lastSubmitCode;
    if (!code) {
      try {
        const monaco = window.monaco;
        if (monaco?.editor) {
          const models = monaco.editor.getModels();
          if (models.length) code = models[0].getValue();
        }
      } catch (e) {
        /* noop */
      }
    }
    window.postMessage(
      {
        type: "ALGOSTUDY_SUBMIT_RESULT",
        accepted,
        statusMsg: json.status_msg || "",
        language: lastSubmitLang || json.pretty_lang || json.lang || "",
        code,
      },
      "*",
    );
  }

  // fetch 래핑
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (isSubmitUrl(url) && args[1]?.body) grabSubmitBody(args[1].body);
    } catch (e) {
      /* noop */
    }
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (isCheckUrl(url)) res.clone().json().then(handleCheckPayload).catch(() => {});
    } catch (e) {
      /* noop */
    }
    return res;
  };

  // XHR 래핑
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__algostudyUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (isSubmitUrl(this.__algostudyUrl)) grabSubmitBody(body);
    } catch (e) {
      /* noop */
    }
    this.addEventListener("load", () => {
      try {
        if (isCheckUrl(this.__algostudyUrl)) handleCheckPayload(JSON.parse(this.responseText));
      } catch (e) {
        /* noop */
      }
    });
    return origSend.apply(this, arguments);
  };
})();
