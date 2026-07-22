import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

async function loadPassingObserverHarness() {
  let observerCallback;
  let buttonUpdates = 0;
  const button = {
    style: {},
    get textContent() {
      return "";
    },
    set textContent(_value) {
      buttonUpdates += 1;
    },
  };

  const context = {
    chrome: {
      runtime: {
        getURL: () => "chrome-extension://test/inject-programmers.js",
        lastError: null,
        sendMessage: () => undefined,
      },
      storage: { local: { get: async () => ({}) } },
    },
    document: {
      body: { appendChild: () => undefined },
      documentElement: { appendChild: () => undefined },
      head: { appendChild: () => undefined },
      addEventListener: () => undefined,
      createElement: () => ({ onload: null, remove: () => undefined, src: "", style: {} }),
      getElementById: (id) => (id === "algostudy-btn" ? button : null),
      querySelectorAll: (selector) => (selector === ".modal-title" ? [{ textContent: "정답입니다!" }] : []),
      removeEventListener: () => undefined,
    },
    MutationObserver: class {
      constructor(callback) {
        observerCallback = callback;
      }

      observe() {}
    },
    Promise,
    location: { pathname: "/learn/courses/30/lessons/340207" },
    setInterval: () => 0,
    setTimeout: () => 0,
    window: {
      addEventListener: () => undefined,
      postMessage: () => undefined,
      removeEventListener: () => undefined,
    },
  };
  const source = await readFile(new URL("./content-programmers.js", import.meta.url), "utf8");
  vm.runInNewContext(source, context);

  return {
    notifyPassObserver: () => observerCallback(),
    buttonUpdateCount: () => buttonUpdates,
  };
}

describe("Programmers pass observer", () => {
  it("updates the extension button only once when pass mutations repeat", async () => {
    const harness = await loadPassingObserverHarness();

    harness.notifyPassObserver();
    harness.notifyPassObserver();

    expect(harness.buttonUpdateCount()).toBe(1);
  });
});
