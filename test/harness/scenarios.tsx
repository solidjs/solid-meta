/** @jsxImportSource @solidjs/web */

// Shared scenario apps for the SSR -> hydrate parity harness. The server
// project (vitest.config.ssr.ts) renders these with the ssr generate and
// writes chunk artifacts; the hydrate project (vitest.config.hydrate.ts)
// replays those artifacts into jsdom and hydrates the same source compiled
// with the dom generate. Any asymmetry in owner/hydration-id allocation
// between the two runtimes shows up as unclaimed nodes, re-run async
// factories, or hydration warnings.
import { createMemo, createSignal, Loading } from "solid-js";
import { Meta, Title } from "../../src";

export interface Scenario {
  name: string;
  App: () => any;
  /** document.title once hydration settles */
  expectedTitle: string;
  /** body textContent once hydration settles */
  expectedText: string;
  /** whether the scenario streams async content (settle waits + streamed mode) */
  async?: boolean;
  /** fire a client-side update after hydration */
  update?: () => void;
  expectedTitleAfterUpdate?: string;
  expectedTextAfterUpdate?: string;
}

function asyncValue<T>(value: T, ms: number): Promise<T> {
  return new Promise(r => setTimeout(() => r(value), ms));
}

// --- title-dynamic-sync -----------------------------------------------------
// Multi-part Title children (`My {name()} Site`) compile to an array with a
// per-hole computation allocated inside the descriptor's children getter.
// Without registration-time pinning that allocation happens in the registry
// effect on the client but at stream flush on the server, drifting every
// hydration id allocated after it.
const [name, setName] = createSignal("Solid");

const titleDynamicSync: Scenario = {
  name: "title-dynamic-sync",
  App: () => (
    <html>
      <head>
        <Meta name="description" content="parity" />
      </head>
      <body>
        <div id="app">
          <Title>My {name()} Site</Title>
          <p>Framework: {name()}</p>
        </div>
      </body>
    </html>
  ),
  expectedTitle: "My Solid Site",
  expectedText: "Framework: Solid",
  update: () => setName("Fine"),
  expectedTitleAfterUpdate: "My Fine Site",
  expectedTextAfterUpdate: "Framework: Fine"
};

// --- title-async ------------------------------------------------------------
// An async read inside the Title body plus serialized async content after it,
// at the root (no boundary): the pending head prop holds the streaming shell.
const titleAsync: Scenario = {
  name: "title-async",
  App: () => {
    const site = createMemo(() => asyncValue("Async", 5));
    const data = createMemo(() => asyncValue("world", 10));
    return (
      <html>
        <head></head>
        <body>
          <div id="app">
            <Title>Page {site()}</Title>
            <p>Hello {data()}</p>
          </div>
        </body>
      </html>
    );
  },
  expectedTitle: "Page Async",
  expectedText: "Hello world",
  async: true
};

// --- title-async-boundary ---------------------------------------------------
// The reported shape: an async Title body inside a Loading boundary with
// sibling content and templates after it. Element hydration keys (_hk) share
// the id counter with computations, so if the title body's inner computation
// allocates at fragment flush on the server but in the registry effect on the
// client, every template claimed after it drifts and hydration mismatches.
const [suffix, setSuffix] = createSignal("");

const titleAsyncBoundary: Scenario = {
  name: "title-async-boundary",
  App: () => {
    const site = createMemo(() => asyncValue("Async", 5));
    const data = createMemo(() => asyncValue("world", 10));
    return (
      <html>
        <head></head>
        <body>
          <div id="app">
            <Loading fallback={<span>Loading...</span>}>
              <Title>Page {site()}</Title>
              <section>
                <p>Hello {data()}</p>
                <p>Static tail{suffix()}</p>
              </section>
            </Loading>
          </div>
        </body>
      </html>
    );
  },
  expectedTitle: "Page Async",
  expectedText: "Hello worldStatic tail",
  async: true,
  update: () => setSuffix("!"),
  expectedTitleAfterUpdate: "Page Async",
  expectedTextAfterUpdate: "Hello worldStatic tail!"
};

export const scenarios: Scenario[] = [titleDynamicSync, titleAsync, titleAsyncBoundary];
