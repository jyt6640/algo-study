import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

async function loadUploadHarness({ deferIngest = false } = {}) {
  const listeners = [];
  const requests = [];
  const ingests = [];
  let button;

  const window = {
    addEventListener(type, listener) {
      if (type === "message") listeners.push(listener);
    },
    removeEventListener(type, listener) {
      if (type !== "message") return;
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
    postMessage(data) {
      const response = data?.type === "ALGOSTUDY_CAPTURE_REQUEST"
        ? { type: "ALGOSTUDY_CAPTURE_RESULT", code: "return 3;", language: "javascript" }
        : data;
      for (const listener of [...listeners]) listener({ source: window, data: response });
    },
  };

  const context = {
    chrome: {
      runtime: {
        getURL: () => "chrome-extension://test/inject.js",
        lastError: null,
        sendMessage: (message, callback) => {
          ingests.push({ payload: message.payload, reply: callback });
          if (!deferIngest) callback({ ok: true, isNew: true, codeSaved: true });
        },
      },
      storage: { local: { get: async () => ({ token: "token" }) } },
    },
    confirm: () => true,
    document: {
      body: { appendChild: (node) => { if (node.id === "algostudy-btn") button = node; } },
      head: { appendChild: () => undefined },
      createElement: (tagName) => {
        if (tagName === "button") {
          const node = {
            id: "",
            textContent: "",
            disabled: false,
            style: {},
            classList: { add: () => undefined },
            addEventListener: (_type, listener) => { node.click = listener; },
          };
          return node;
        }
        return { src: "", onload: null, remove: () => undefined, textContent: "", style: {} };
      },
      getElementById: (id) => (id === "algostudy-btn" ? button : null),
      title: "Two Sum - LeetCode",
    },
    fetch: async (_url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      if (request.query.includes("userStatus")) {
        return jsonResponse({ data: { userStatus: { username: "tester" } } });
      }
      return jsonResponse({ data: { recentAcSubmissionList: [{ titleSlug: "two-sum" }] } });
    },
    location: { pathname: "/problems/two-sum/" },
    setInterval: () => 0,
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    window,
  };

  const source = await readFile(new URL("./content.js", import.meta.url), "utf8");
  vm.runInNewContext(source, context);

  return {
    click: () => button.click(),
    ingestPayload: () => ingests.at(-1)?.payload,
    ingests,
    accept: (submissionId, code) => window.postMessage({
      type: "ALGOSTUDY_SUBMIT_RESULT", slug: "two-sum", accepted: true, submissionId, code, language: "javascript",
    }),
    label: () => button.textContent,
    requests,
  };
}

describe("LeetCode manual upload", () => {
  it("uploads when polling finds Accepted without an intercepted submit", async () => {
    const harness = await loadUploadHarness();

    await expect(harness.click()).resolves.toBeUndefined();

    expect(harness.requests).toHaveLength(2);
    expect(harness.ingestPayload()).toMatchObject({
      problemSlug: "two-sum",
      code: "return 3;",
      language: "javascript",
    });
    expect(harness.ingestPayload().acceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("LeetCode automatic upload", () => {
  it("waits for code storage and also uploads the next accepted attempt for the same problem", async () => {
    const harness = await loadUploadHarness({ deferIngest: true });

    harness.accept("42", "first()");
    await Promise.resolve();
    expect(harness.ingests).toHaveLength(1);
    expect(harness.label()).not.toContain("업로드됨");
    harness.ingests[0].reply({ ok: true, codeSaved: true });
    expect(harness.label()).toContain("업로드됨");

    harness.accept("43", "second()");
    await Promise.resolve();
    expect(harness.ingestPayload()).toMatchObject({ problemSlug: "two-sum", code: "second()" });
    harness.ingests[1].reply({ ok: true, codeSaved: false });
    expect(harness.label()).not.toContain("업로드됨");
  });
});
