/** @jsxImportSource @solidjs/web */

// Server half of the head hydration parity harness. Renders every scenario
// from test/harness/scenarios.tsx with the ssr generate, asserts the head
// output, and writes chunk artifacts for test/hydration/head-parity.spec.tsx
// to replay against the dom-generate compilation of the same source.
import { describe, expect, test } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStream } from "@solidjs/web";
import { scenarios } from "../harness/scenarios.jsx";

const artifactsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../harness/__artifacts__");
mkdirSync(artifactsDir, { recursive: true });

function collectChunks(code: () => any): Promise<{ shell: string; rest: string }> {
  return new Promise(resolvePromise => {
    const chunks: string[] = [];
    let shell = "";
    let shellDone = false;
    renderToStream(code, {
      onCompleteShell() {
        shellDone = true;
      }
    }).pipe({
      write(chunk: string) {
        chunks.push(chunk);
        if (shellDone && !shell) shell = chunks.join("");
      },
      end() {
        const full = chunks.join("");
        if (!shell) shell = full;
        resolvePromise({ shell, rest: full.slice(shell.length) });
      }
    });
  });
}

describe("head parity harness — server render", () => {
  for (const scenario of scenarios) {
    test(scenario.name, async () => {
      const { shell, rest } = await collectChunks(() => <scenario.App />);
      const full = shell + rest;
      // Root-level titles land in the shell head with their claim key;
      // boundary-attributed ones ride the fragment stream as patch ops.
      const asShellTag = shell.includes(`>${scenario.expectedTitle}</title>`);
      const asPatchOp = full.includes(`"t","${scenario.expectedTitle}"`);
      expect(asShellTag || asPatchOp, "expected title in shell or as patch op").toBe(true);
      if (asShellTag) expect(shell).toContain(`data-dh="title"`);

      const visible = full.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]*>/g, "");
      for (const token of scenario.expectedText.split(/\s+/).filter(Boolean)) {
        expect(visible).toContain(token);
      }

      writeFileSync(
        resolve(artifactsDir, `${scenario.name}.json`),
        JSON.stringify({ name: scenario.name, shell, rest }, null, 2)
      );
    });
  }
});
