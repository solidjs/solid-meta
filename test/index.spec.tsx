import { createSignal, flush, Show } from "solid-js";
import { hydrate, render, useHead } from "@solidjs/web";
import { Head, Link, Meta, Script, Style, Stylesheet, Title } from "../src";
import { hydrationScript, removeScript } from "./hydration_script";
import { describe, test, expect, beforeAll, vi } from "vitest";

// The head registry applies on a microtask and is a module singleton, so
// tests share document.head deliberately: every test disposes its roots and
// awaits the flush so it leaves the registry empty. The static fallback
// title is installed once and stays for the whole file.
const tick = () => Promise.resolve();

beforeAll(() => {
  document.head.innerHTML = "<title>Static</title>";
});

describe("head tag components", () => {
  test("renders head tags into document.head and removes them on dispose", async () => {
    const div = document.createElement("div");
    const dispose = render(
      () => (
        <div>
          Yes render
          <Title>Test title</Title>
          <Style>{`body {}`}</Style>
          <Meta name="description" content="desc" />
          <Link rel="canonical" href="https://solidjs.com/" />
        </div>
      ),
      div
    );
    await tick();
    expect(document.title).toBe("Test title");
    expect(document.head.querySelector("style")!.textContent).toBe("body {}");
    const meta = document.head.querySelector('meta[name="description"]')!;
    expect(meta.getAttribute("content")).toBe("desc");
    expect(meta.getAttribute("data-dh")).toBe("meta:name:description");
    expect(document.head.querySelector('link[rel="canonical"]')!.getAttribute("href")).toBe(
      "https://solidjs.com/"
    );

    dispose();
    await tick();
    expect(document.title).toBe("Static");
    expect(document.head.querySelector("style")).toBe(null);
    expect(document.head.querySelector('meta[name="description"]')).toBe(null);
    expect(document.head.querySelector('link[rel="canonical"]')).toBe(null);
  });

  test("renders only the last title and cascades back through unmounts", async () => {
    const div = document.createElement("div");
    const [visible, setVisible] = createSignal(true);
    const dispose = render(
      () => (
        <>
          <div>
            <Title>Title 1</Title>
          </div>
          <div>
            <Title>Title 2</Title>
          </div>
          <Show when={visible()}>
            <div>
              <Title>Title 3</Title>
            </div>
          </Show>
        </>
      ),
      div
    );
    await tick();
    expect(document.title).toBe("Title 3");
    expect(document.querySelectorAll("title").length).toBe(1);

    setVisible(false);
    flush();
    await tick();
    expect(document.title).toBe("Title 2");

    dispose();
    await tick();
    expect(document.title).toBe("Static");
  });

  test("unmounting a non-winning title does not change the winner", async () => {
    const div = document.createElement("div");
    const [visible, setVisible] = createSignal(true);
    const dispose = render(
      () => (
        <>
          <Show when={visible()}>
            <div>
              <Title>Title 1</Title>
            </div>
          </Show>
          <div>
            <Title>Title 2</Title>
          </div>
        </>
      ),
      div
    );
    await tick();
    expect(document.title).toBe("Title 2");

    setVisible(false);
    flush();
    await tick();
    expect(document.title).toBe("Title 2");

    dispose();
    await tick();
  });

  test("page meta overrides layout meta with the same name and restores on unmount", async () => {
    const div = document.createElement("div");
    const [page, setPage] = createSignal(false);
    const dispose = render(
      () => (
        <>
          <Meta name="description" content="layout" />
          <Show when={page()}>
            <Meta name="description" content="page" />
          </Show>
        </>
      ),
      div
    );
    await tick();
    let metas = document.head.querySelectorAll('meta[name="description"]');
    expect(metas.length).toBe(1);
    expect(metas[0].getAttribute("content")).toBe("layout");

    setPage(true);
    flush();
    await tick();
    metas = document.head.querySelectorAll('meta[name="description"]');
    expect(metas.length).toBe(1);
    expect(metas[0].getAttribute("content")).toBe("page");

    setPage(false);
    flush();
    await tick();
    expect(document.head.querySelector('meta[name="description"]')!.getAttribute("content")).toBe(
      "layout"
    );

    dispose();
    await tick();
    expect(document.head.querySelector('meta[name="description"]')).toBe(null);
  });

  test("theme-color metas fork identity by media", async () => {
    const div = document.createElement("div");
    const dispose = render(
      () => (
        <>
          <Meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff" />
          <Meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000" />
        </>
      ),
      div
    );
    await tick();
    const metas = [...document.head.querySelectorAll('meta[name="theme-color"]')];
    expect(metas.map(m => m.getAttribute("content"))).toEqual(["#fff", "#000"]);

    dispose();
    await tick();
    expect(document.head.querySelectorAll('meta[name="theme-color"]').length).toBe(0);
  });

  test("name and property are separate namespaces; a shared key unifies them", async () => {
    const div = document.createElement("div");
    const dispose = render(
      () => (
        <>
          <Meta name="twitter:creator" content="@solid_js" />
          <Meta property="twitter:creator" content="@ryancarniato" />
          <Meta key="site" name="twitter:site" content="@one" />
          <Meta key="site" property="og:site_name" content="two" />
        </>
      ),
      div
    );
    await tick();
    // Unkeyed: separate namespaces coexist.
    expect(document.head.querySelectorAll('meta[content="@solid_js"]').length).toBe(1);
    expect(document.head.querySelectorAll('meta[content="@ryancarniato"]').length).toBe(1);
    // Keyed: one identity, last wins.
    expect(document.head.querySelector('meta[content="@one"]')).toBe(null);
    expect(document.head.querySelector('meta[content="two"]')).not.toBe(null);

    dispose();
    await tick();
  });

  test("swapping favicons replaces instead of accumulating", async () => {
    const div = document.createElement("div");
    const [alert, setAlert] = createSignal(false);
    const dispose = render(
      () => (
        <>
          <Link rel="icon" href="/favicon.ico" />
          <Show when={alert()}>
            <Link rel="icon" href="/favicon-alert.ico" />
          </Show>
        </>
      ),
      div
    );
    await tick();
    let icons = [...document.head.querySelectorAll('link[rel="icon"]')];
    expect(icons.map(l => l.getAttribute("href"))).toEqual(["/favicon.ico"]);

    setAlert(true);
    flush();
    await tick();
    icons = [...document.head.querySelectorAll('link[rel="icon"]')];
    expect(icons.map(l => l.getAttribute("href"))).toEqual(["/favicon-alert.ico"]);

    setAlert(false);
    flush();
    await tick();
    icons = [...document.head.querySelectorAll('link[rel="icon"]')];
    expect(icons.map(l => l.getAttribute("href"))).toEqual(["/favicon.ico"]);

    dispose();
    await tick();
    expect(document.head.querySelectorAll('link[rel="icon"]').length).toBe(0);
  });

  test("escapes title text on the client via textContent", async () => {
    const div = document.createElement("div");
    const text = 'Hello</title><script>alert("inject");</script><title> World';
    const dispose = render(() => <Title>{text}</Title>, div);
    await tick();
    expect(document.title).toBe(text);
    expect(document.head.querySelectorAll("script").length).toBe(0);

    dispose();
    await tick();
  });

  test("Script renders an inline JSON-LD body", async () => {
    const div = document.createElement("div");
    const jsonLd = JSON.stringify({ "@type": "WebSite", name: "Solid" });
    const dispose = render(
      () => (
        <Script type="application/ld+json" key="ld">
          {jsonLd}
        </Script>
      ),
      div
    );
    await tick();
    const script = document.head.querySelector('script[type="application/ld+json"]')!;
    expect(JSON.parse(script.textContent!)).toEqual({ "@type": "WebSite", name: "Solid" });

    dispose();
    await tick();
    expect(document.head.querySelector("script")).toBe(null);
  });

  test("stylesheets are removed on unmount; fetch hints persist", async () => {
    const div = document.createElement("div");
    const dispose = render(
      () => (
        <>
          <Stylesheet href="/page.css" />
          <Link rel="preload" href="/hero.jpg" as="image" />
        </>
      ),
      div
    );
    // rc.0 gates stylesheets: the link enters as a style preload and flips to
    // rel="stylesheet" once its load settles (jsdom never fires load, so
    // dispatch it by hand).
    const pre = document.head.querySelector('link[as="style"]')!;
    expect(pre.getAttribute("href")).toBe("/page.css");
    pre.dispatchEvent(new Event("load"));
    flush();
    await new Promise(resolve => setTimeout(resolve, 10));
    const sheet = document.head.querySelector('link[rel="stylesheet"]')!;
    expect(sheet.getAttribute("href")).toBe("/page.css");
    expect(document.head.querySelectorAll('link[rel="preload"]').length).toBe(1);

    vi.useFakeTimers();
    try {
      dispose();
      await tick();
      vi.runAllTimers();
    } finally {
      vi.useRealTimers();
    }
    expect(sheet.isConnected).toBe(false);
    // Retracting a hint is pointless churn: it stays for the session.
    expect(document.head.querySelectorAll('link[rel="preload"]').length).toBe(1);
    document.head.querySelector('link[rel="preload"]')!.remove();
  });

  test("core useHead interop: an array registers as one group", async () => {
    const div = document.createElement("div");
    const dispose = render(() => {
      useHead([
        { tag: "meta", props: { property: "og:image", content: "/a.png" } },
        { tag: "meta", props: { property: "og:image", content: "/b.png" } }
      ]);
      return null;
    }, div);
    await tick();
    const imgs = [...document.head.querySelectorAll('meta[property="og:image"]')];
    expect(imgs.map(m => m.getAttribute("content"))).toEqual(["/a.png", "/b.png"]);

    dispose();
    await tick();
    expect(document.head.querySelectorAll('meta[property="og:image"]').length).toBe(0);
  });
});

describe("<Head> groups", () => {
  test("groups same-identity tags and replaces the set atomically", async () => {
    const div = document.createElement("div");
    const [page, setPage] = createSignal(false);
    const dispose = render(
      () => (
        <>
          <Head>
            <Meta property="og:image" content="/a.png" />
            <Meta property="og:image" content="/b.png" />
          </Head>
          <Show when={page()}>
            <Head>
              <Meta property="og:image" content="/c.png" />
            </Head>
          </Show>
        </>
      ),
      div
    );
    await tick();
    let imgs = [...document.head.querySelectorAll('meta[property="og:image"]')];
    expect(imgs.map(m => m.getAttribute("content"))).toEqual(["/a.png", "/b.png"]);

    setPage(true);
    flush();
    await tick();
    imgs = [...document.head.querySelectorAll('meta[property="og:image"]')];
    expect(imgs.map(m => m.getAttribute("content"))).toEqual(["/c.png"]);

    setPage(false);
    flush();
    await tick();
    imgs = [...document.head.querySelectorAll('meta[property="og:image"]')];
    expect(imgs.map(m => m.getAttribute("content"))).toEqual(["/a.png", "/b.png"]);

    dispose();
    await tick();
    expect(document.head.querySelectorAll('meta[property="og:image"]').length).toBe(0);
  });

  test("group membership is reactive, including through component calls", async () => {
    const OgImage = (props: { src: string }) => <Meta property="og:image" content={props.src} />;
    const div = document.createElement("div");
    const [extra, setExtra] = createSignal(false);
    const dispose = render(
      () => (
        <Head>
          <Meta property="og:image" content="/a.png" />
          <Show when={extra()}>
            <OgImage src="/b.png" />
          </Show>
        </Head>
      ),
      div
    );
    await tick();
    let imgs = [...document.head.querySelectorAll('meta[property="og:image"]')];
    expect(imgs.map(m => m.getAttribute("content"))).toEqual(["/a.png"]);

    setExtra(true);
    flush();
    await tick();
    imgs = [...document.head.querySelectorAll('meta[property="og:image"]')];
    expect(imgs.map(m => m.getAttribute("content"))).toEqual(["/a.png", "/b.png"]);

    setExtra(false);
    flush();
    await tick();
    imgs = [...document.head.querySelectorAll('meta[property="og:image"]')];
    expect(imgs.map(m => m.getAttribute("content"))).toEqual(["/a.png"]);

    dispose();
    await tick();
  });

  test("a nested <Head> forms its own independent group", async () => {
    const div = document.createElement("div");
    const [inner, setInner] = createSignal(true);
    const dispose = render(
      () => (
        <Head>
          <Meta property="og:image" content="/outer.png" />
          <Show when={inner()}>
            <Head>
              <Meta property="og:image" content="/inner.png" />
            </Head>
          </Show>
        </Head>
      ),
      div
    );
    await tick();
    // The inner group commits later, so it wins the identity outright —
    // it did not merge into the outer set.
    let imgs = [...document.head.querySelectorAll('meta[property="og:image"]')];
    expect(imgs.map(m => m.getAttribute("content"))).toEqual(["/inner.png"]);

    setInner(false);
    flush();
    await tick();
    imgs = [...document.head.querySelectorAll('meta[property="og:image"]')];
    expect(imgs.map(m => m.getAttribute("content"))).toEqual(["/outer.png"]);

    dispose();
    await tick();
  });
});

describe("hydration", () => {
  test("claims server-rendered head tags instead of recreating them", async () => {
    hydrationScript();
    document.head.innerHTML =
      '<title data-dh="title">Hydrated</title>' +
      '<meta name="description" content="d" data-dh="meta:name:description">';
    const serverTitle = document.head.querySelector("title");
    const serverMeta = document.head.querySelector("meta");
    const div = document.createElement("div");
    const dispose = hydrate(
      () => (
        <>
          <Title>Hydrated</Title>
          <Meta name="description" content="d" />
        </>
      ),
      div
    );
    // During hydration the registry defers and retries on macrotasks.
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(document.querySelectorAll("title").length).toBe(1);
    expect(document.head.querySelector("title")).toBe(serverTitle);
    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
    expect(document.head.querySelector('meta[name="description"]')).toBe(serverMeta);

    dispose();
    removeScript();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(document.head.querySelector('meta[name="description"]')).toBe(null);
  });
});
