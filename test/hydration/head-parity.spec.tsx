/** @jsxImportSource @solidjs/web */

// Client half of the head hydration parity harness. Replays the streamed
// chunks written by test/server/head-harness.spec.tsx into jsdom's document
// and hydrates the identically-sourced app (dom generate). Invariants:
//
//  1. No console.warn — unclaimed-node reports and claim mismatches from the
//     dev runtime fail the test.
//  2. Server-rendered body elements keep identity through hydration — an
//     owner/hydration-id drift (e.g. a head-tag body allocating its inner
//     computation at a different point on each runtime) makes claims miss
//     and nodes get recreated. Claim failures also surface as thrown
//     "Hydration Mismatch" errors, failing the test outright.
//  3. document.title and body text are correct after settle, and client-side
//     updates still work.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flush } from "solid-js";
import { hydrate } from "@solidjs/web";
import { scenarios, type Scenario } from "../harness/scenarios.jsx";

const artifactsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../harness/__artifacts__");

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function loadArtifact(name: string): { shell: string; rest: string } {
  const file = resolve(artifactsDir, `${name}.json`);
  if (!existsSync(file)) {
    throw new Error(
      `Missing artifact for scenario "${name}". Run the server harness first: ` +
        `vitest run -c vitest.config.ssr.ts`
    );
  }
  return JSON.parse(readFileSync(file, "utf-8"));
}

const scriptRe = /<script(?:[^>]*)>([\s\S]*?)<\/script>/g;

function applyShell(shell: string) {
  const scripts = [...shell.matchAll(scriptRe)].map(m => m[1]);
  const stripped = shell.replace(scriptRe, "");
  const parsed = new DOMParser().parseFromString(stripped, "text/html");
  // The root <html> carries a hydration key (_hk) the app claims — copy its
  // attributes, not just its contents.
  for (const attr of [...parsed.documentElement.attributes]) {
    document.documentElement.setAttribute(attr.name, attr.value);
  }
  document.documentElement.innerHTML = parsed.documentElement.innerHTML;
  for (const s of scripts) (0, eval)(s);
}

function applyRest(rest: string) {
  const scripts = [...rest.matchAll(scriptRe)].map(m => m[1]);
  const stripped = rest.replace(scriptRe, "");
  if (stripped.trim()) document.body.insertAdjacentHTML("beforeend", stripped);
  for (const s of scripts) (0, eval)(s);
}

async function settle() {
  await sleep(30);
  flush();
  await sleep(30);
  flush();
}

async function runScenario(scenario: Scenario) {
  const { shell, rest } = loadArtifact(scenario.name);
  (globalThis as any)._$HY = { events: [], completed: new WeakSet(), r: {}, fe() {} };
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  let dispose: (() => void) | undefined;

  try {
    applyShell(shell);
    if (rest) applyRest(rest);

    // Server-rendered nodes must survive hydration with identity intact.
    const serverNodes = [...document.body.querySelectorAll("p")];
    const serverTitle = document.head.querySelector("title");
    expect(serverTitle).not.toBe(null);

    dispose = hydrate(() => <scenario.App />, document);
    flush();
    await sleep(10);
    flush();
    if (scenario.async) await settle();
    // head registry applies on a microtask (with hydration retries on macrotasks)
    await sleep(10);

    expect(document.title).toBe(scenario.expectedTitle);
    expect(document.head.querySelectorAll("title").length).toBe(1);
    expect(document.body.textContent).toBe(scenario.expectedText);

    const afterNodes = [...document.body.querySelectorAll("p")];
    expect(afterNodes.length).toBe(serverNodes.length);
    for (let i = 0; i < serverNodes.length; i++) {
      expect(afterNodes[i], `server <p> #${i} was replaced during hydration`).toBe(serverNodes[i]);
    }

    if (scenario.update) {
      scenario.update();
      flush();
      await sleep(10);
      expect(document.title).toBe(scenario.expectedTitleAfterUpdate ?? scenario.expectedTitle);
      expect(document.body.textContent).toBe(
        scenario.expectedTextAfterUpdate ?? scenario.expectedText
      );
    }

    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
    dispose?.();
    await sleep(0);
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    for (const attr of [...document.documentElement.attributes]) {
      document.documentElement.removeAttribute(attr.name);
    }
    (globalThis as any)._$HY = undefined;
  }
}

describe("head parity harness — client hydrate", () => {
  beforeEach(async () => {
    await sleep(0);
  });
  afterEach(async () => {
    await sleep(0);
  });

  for (const scenario of scenarios) {
    test(scenario.name, () => runScenario(scenario));
  }
});
