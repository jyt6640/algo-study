import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

async function loadUploadHarness() {
  const listeners = [];
  const requests = [];
  let ingestPayload;
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
          ingestPayload = message.payload;
          callback({ ok: true, isNew: true });
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
    window,
  };

  const source = await readFile(new URL("./content.js", import.meta.url), "utf8");
  vm.runInNewContext(source, context);

  return {
    click: () => button.click(),
    ingestPayload: () => ingestPayload,
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
