import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

async function loadBackgroundHarness() {
  const requests = [];
  let listener;
  const context = {
    chrome: {
      runtime: { onMessage: { addListener(callback) { listener = callback; } } },
      storage: { local: { get: async () => ({}) } },
    },
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      if (body.query.includes("userStatus")) {
        return jsonResponse({ data: { userStatus: { isSignedIn: true, username: "tester" } } });
      }
      if (body.query.includes("recentAcSubmissionList")) {
        return jsonResponse({
          data: { recentAcSubmissionList: [{ id: "42", title: "Two Sum", titleSlug: "two-sum", timestamp: "1" }] },
        });
      }
      return jsonResponse({ data: { submissionDetails: { code: "return [];", lang: { name: "JavaScript" } } } });
    },
  };
  const source = await readFile(new URL("./background.js", import.meta.url), "utf8");
  vm.runInNewContext(source, context);

  return {
    request() {
      let resolveResponse;
      const response = new Promise((resolve) => {
        resolveResponse = resolve;
      });
      const keepChannelOpen = listener({ type: "ALGOSTUDY_FETCH_LEETCODE" }, {}, resolveResponse);
      return { keepChannelOpen, response, requests };
    },
  };
}

describe("extension background LeetCode import", () => {
  it("fetches LeetCode data in the service worker and returns it to the website bridge", async () => {
    // Given
    const harness = await loadBackgroundHarness();

    // When
    const request = harness.request();

    // Then
    expect(request.keepChannelOpen).toBe(true);
    await expect(request.response).resolves.toEqual({
      problems: [
        {
          acceptedAt: "1970-01-01T00:00:01.000Z",
          code: "return [];",
          language: "JavaScript",
          slug: "two-sum",
          title: "Two Sum",
        },
      ],
    });
    expect(request.requests).toHaveLength(3);
  });
});
