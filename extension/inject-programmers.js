// 프로그래머스 페이지 컨텍스트: CodeMirror 코드 읽기 + 채점 결과(/learn/challenges) 인터셉트.
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

  // 채점 응답에서 "전체 통과" 신호 감지
  function handle(text) {
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      /* not json */
    }
    let passed = false;
    if (json) {
      if (json.passed === true) passed = true;
      else if (
        json.passedTestCount != null &&
        json.totalTestCount != null &&
        json.totalTestCount > 0 &&
        json.passedTestCount === json.totalTestCount
      )
        passed = true;
      else if (json.score === 100 || json.score === 100.0) passed = true;
    }
    if (!passed && /"passed"\s*:\s*true/.test(text)) passed = true;
    if (passed) window.postMessage({ type: "ALGOSTUDY_PG_RESULT", passed: true }, "*");
  }

  const isChallenge = (url) => typeof url === "string" && /\/learn\/challenges/.test(url);

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      if (isChallenge(url)) res.clone().text().then(handle).catch(() => {});
    } catch (e) {
      /* noop */
    }
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__algostudyUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        if (isChallenge(this.__algostudyUrl)) handle(this.responseText);
      } catch (e) {
        /* noop */
      }
    });
    return origSend.apply(this, args);
  };
})();
