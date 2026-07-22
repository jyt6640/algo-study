import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

async function loadBridgeHarness(response) {
  const posted = [];
  const requests = [];
  let onMessage;
  const pageWindow = {
    addEventListener(type, listener) {
      if (type === "message") onMessage = listener;
    },
    postMessage(message) {
      posted.push(message);
    },
  };
  const context = {
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          requests.push(message);
          callback(response);
        },
      },
    },
    window: pageWindow,
  };
  const source = await readFile(new URL("./bridge.js", import.meta.url), "utf8");
  vm.runInNewContext(source, context);

  return {
    async requestLeetcode() {
      onMessage({ source: pageWindow, data: { type: "ALGOSTUDY_FETCH_LEETCODE" } });
      await Promise.resolve();
    },
    posted: () => posted,
    requests: () => requests,
  };
}

describe("Algo Study website bridge", () => {
  it("asks the extension service worker for LeetCode data before replying to the page", async () => {
    // Given
    const problems = [{ slug: "two-sum", code: "return []", language: "JavaScript" }];
    const harness = await loadBridgeHarness({ problems });

    // When
    await harness.requestLeetcode();

    // Then
    expect(harness.requests()).toEqual([{ type: "ALGOSTUDY_FETCH_LEETCODE" }]);
    expect(harness.posted()).toContainEqual({ type: "ALGOSTUDY_LEETCODE_DATA", problems });
  });
});
