// 페이지 컨텍스트에서 실행.
// 1) content script 요청 시 Monaco 코드 반환
// 2) 제출 요청(/problems/<slug>/submit/) 본문에서 실제 제출 코드(typed_code) 캡처
// 3) 제출 결과 API(/submissions/detail/<id>/check/)를 가로채 Accepted 감지 (+ 제출 코드 동봉)
(function () {
  const pending = new Map();
  const xhrPaths = new WeakMap();

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

  function submissionPath(input) {
    try {
      const url = new URL(input, location.href);
      if (url.origin === location.origin) return url.pathname;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
    return "";
  }

  const submitSlug = (path) => path.match(/^\/problems\/([^/]+)\/submit\/?$/)?.[1];
  const checkId = (path) => path.match(/^\/submissions\/detail\/(\d+)\/check\/?$/)?.[1];

  function parseBody(body) {
    if (typeof body !== "string") return null;
    try {
      return JSON.parse(body);
    } catch (error) {
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async function readJsonCopy(message) {
    try {
      return await message.clone().json();
    } catch (error) {
      if (error instanceof Error) return null;
      throw error;
    }
  }

  function rememberSubmission(slug, body, json) {
    const id = json?.submission_id;
    if ((typeof id !== "number" && typeof id !== "string") || !/^\d+$/.test(String(id))) return;
    if (pending.size >= 64) pending.delete(pending.keys().next().value);
    pending.set(String(id), {
      slug,
      code: typeof body?.typed_code === "string" ? body.typed_code : "",
      language: typeof body?.lang === "string" ? body.lang : "",
    });
  }

  function handleCheckPayload(id, json) {
    if (json?.state !== "SUCCESS") return;
    const submission = pending.get(id);
    if (!submission) return;
    pending.delete(id);
    window.postMessage(
      {
        type: "ALGOSTUDY_SUBMIT_RESULT",
        submissionId: id,
        slug: submission.slug,
        accepted: json.status_msg === "Accepted" || Number(json.status_code) === 10,
        statusMsg: json.status_msg || "",
        language: submission.language || json.pretty_lang || json.lang || "",
        code: submission.code,
      },
      location.origin,
    );
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const request = typeof input?.clone === "function" ? input : null;
    const path = submissionPath(request ? request.url : input);
    const slug = submitSlug(path);
    const id = checkId(path);
    if (!slug && !id) return origFetch.apply(this, arguments);

    const body = slug && init?.body == null && request && !request.bodyUsed
      ? readJsonCopy(request)
      : parseBody(slug ? init?.body : null);
    return origFetch.apply(this, arguments).then(async (res) => {
      if (!res.ok) return res;
      if (slug) {
        const [submittedBody, json] = await Promise.all([body, readJsonCopy(res)]);
        rememberSubmission(slug, submittedBody, json);
      } else {
        await readJsonCopy(res).then((json) => handleCheckPayload(id, json));
      }
      return res;
    });
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    xhrPaths.set(this, submissionPath(url));
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const path = xhrPaths.get(this) || "";
    const slug = submitSlug(path);
    const id = checkId(path);
    if (slug || id) {
      const submittedBody = slug ? parseBody(body) : null;
      this.addEventListener("loadend", () => {
        if (this.status < 200 || this.status >= 300) return;
        const json = this.responseType === "json" ? this.response
          : !this.responseType || this.responseType === "text" ? parseBody(this.responseText) : null;
        if (slug) rememberSubmission(slug, submittedBody, json);
        else handleCheckPayload(id, json);
      }, { once: true });
    }
    return origSend.apply(this, arguments);
  };
})();
