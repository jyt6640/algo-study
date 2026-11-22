import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const origin = "https://leetcode.com";
const accepted = { state: "SUCCESS", status_code: 10 };

async function loadHarness() {
  const results = [];
  const replies = new Map();
  class TestXhr extends EventTarget {
    open(_method, url) { this.url = url; }
    send() {
      this.status = 200;
      const reply = replies.get(this.url);
      this.response = reply;
      this.responseText = JSON.stringify(reply);
      this.dispatchEvent(new Event("load"));
      this.dispatchEvent(new Event("loadend"));
    }
  }
  const window = {
    addEventListener() {},
    postMessage(message) { results.push(message); },
    fetch: async (input) => {
      const url = typeof input === "string" ? input : input.url;
      return Response.json(replies.get(url));
    },
  };
  const source = await readFile(new URL("./inject.js", import.meta.url), "utf8");
  vm.runInNewContext(source, { window, XMLHttpRequest: TestXhr, URL, location: new URL(origin) });
  return { window, replies, results, TestXhr };
}

describe("LeetCode submission capture", () => {
  it("loads both scripts before the site initializes, including when entering via the problem list", async () => {
    const manifest = JSON.parse(await readFile(new URL("./manifest.json", import.meta.url), "utf8"));
    expect(manifest.content_scripts).toEqual(expect.arrayContaining([
      expect.objectContaining({ matches: [`${origin}/*`], js: ["inject.js"], run_at: "document_start", world: "MAIN" }),
      expect.objectContaining({ matches: [`${origin}/*`], js: ["content.js"], run_at: "document_start" }),
    ]));
  });

  it("pairs an accepted Request submission with its own code even after another submission", async () => {
    const { window, replies, results } = await loadHarness();
    const first = `${origin}/problems/two-sum/submit/`;
    const second = `${origin}/problems/add-two-numbers/submit/`;
    const check = `${origin}/submissions/detail/42/check/`;
    replies.set(first, { submission_id: 42 });
    replies.set(second, { submission_id: 43 });
    replies.set(check, accepted);

    await window.fetch(new Request(first, { method: "POST", body: JSON.stringify({ typed_code: "first()", lang: "python3" }) }));
    await window.fetch(second, { method: "POST", body: JSON.stringify({ typed_code: "second()", lang: "java" }) });
    await window.fetch(check);
    await window.fetch(check);

    await vi.waitFor(() => expect(results).toEqual([
      expect.objectContaining({ accepted: true, submissionId: "42", slug: "two-sum", code: "first()", language: "python3" }),
    ]));
  });

  it("captures XHR submissions and waits for a final accepted verdict", async () => {
    const { replies, results, TestXhr } = await loadHarness();
    const submit = "/problems/two-sum/submit/";
    const check = "/submissions/detail/42/check/";
    replies.set(submit, { submission_id: 42 });
    replies.set(check, { state: "PENDING" });
    const xhr = new TestXhr();
    xhr.open("POST", submit);
    xhr.send(JSON.stringify({ typed_code: "xhr()", lang: "javascript" }));
    xhr.open("GET", check);
    xhr.send();
    expect(results).toEqual([]);

    replies.set(check, accepted);
    xhr.open("GET", check);
    xhr.send();
    expect(results).toEqual([
      expect.objectContaining({ accepted: true, submissionId: "42", slug: "two-sum", code: "xhr()" }),
    ]);
  });
});
