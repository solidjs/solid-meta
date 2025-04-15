/* @jsxImportSource solid-js */
import { createSignal, getOwner, lazy } from "solid-js";
import { hydrate, render, Show } from "solid-js/web";
import { MetaProvider, Title, Style, Meta, Link, Base } from "../src";
import { hydrationScript, removeScript } from "./hydration_script";
import { describe, test, expect, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  document.head.innerHTML = "";
});

afterEach(() => {
  document.head.innerHTML = "";
});

test("renders into document.head portal", () => {
  let div = document.createElement("div");
  const snapshot =
    '<title>Test title</title><style>body {}</style><style>div {}</style><link href="index.css"><link href="favicon.ico"><meta charset="utf-8"><base href="/new_base">';
  const dispose = render(
    () => (
      <MetaProvider>
        <div>
          Yes render
          <Title>Test title</Title>
          <Style>{`body {}`}</Style>
          <Style>{`div {}`}</Style>
          <Link href="index.css" />
          <Link href="favicon.ico" />
          <Meta charset="utf-8" />
          <Base href="/new_base" />
        </div>
      </MetaProvider>
    ),
    div
  );
  expect(document.head.innerHTML).toBe(snapshot);
  dispose();
});

test("renders only the last title", () => {
  let div = document.createElement("div");
  const snapshot = "<title>Title 3</title>";
  const dispose = render(
    () => (
      <MetaProvider>
        <div>
          <Title>Title 1</Title>
        </div>
        <div>
          <Title>Title 2</Title>
        </div>
        <div>
          <Title>Title 3</Title>
        </div>
      </MetaProvider>
    ),
    div
  );
  expect(document.head.innerHTML).toBe(snapshot);
  dispose();
});

test("unmount middle child, should show only the last title", () => {
  let div = document.createElement("div");
  const snapshot = "<title>Title 3</title>";
  const [visible, setVisible] = createSignal(true);
  const dispose = render(
    () => (
      <MetaProvider>
        <div>
          <Title>Title 1</Title>
        </div>
        <Show when={visible()}>
          <div>
            <Title>Title 2</Title>
          </div>
        </Show>
        <div>
          <Title>Title 3</Title>
        </div>
      </MetaProvider>
    ),
    div
  );
  expect(document.head.innerHTML).toBe(snapshot);
  setVisible(false);
  expect(document.head.innerHTML).toBe(snapshot);
  dispose();
});

test("unmount last child, should show only the second last title", () => {
  let div = document.createElement("div");
  const snapshot1 = "<title>Title 3</title>";
  const snapshot2 = "<title>Title 2</title>";
  const [visible, setVisible] = createSignal(true);
  const dispose = render(
    () => (
      <MetaProvider>
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
      </MetaProvider>
    ),
    div
  );
  expect(document.head.innerHTML).toBe(snapshot1);
  setVisible(false);
  expect(document.head.innerHTML).toBe(snapshot2);
  dispose();
});

test("hydrates only the last title", () => {
  hydrationScript();
  let div = document.createElement("div");
  document.head.innerHTML = `<title data-sm="0-0-2-0">Title 3</title>`;
  const snapshot = '<title data-sm="0-0-2-0">Title 3</title><title>Title 3</title>';
  const dispose = hydrate(
    () => (
      <MetaProvider>
        <div>
          <Title>Title 1</Title>
        </div>
        <div>
          <Title>Title 2</Title>
        </div>
        <div>
          <Title>Title 3</Title>
        </div>
      </MetaProvider>
    ),
    div
  );
  expect(document.head.innerHTML).toBe(snapshot);
  dispose();
  removeScript();
});

test("mounts and unmounts title", () => {
  let div = document.createElement("div");
  const snapshot1 = "<title>Static</title>";
  const snapshot2 = "<title>Dynamic</title>";
  const [visible, setVisible] = createSignal(false);
  const dispose = render(
    () => (
      <MetaProvider>
        <Title>Static</Title>
        <Show when={visible()}>
          <Title>Dynamic</Title>
        </Show>
      </MetaProvider>
    ),
    div
  );

  expect(document.head.innerHTML).toBe(snapshot1);
  setVisible(true);
  expect(document.head.innerHTML).toBe(snapshot2);
  setVisible(false);
  expect(document.head.innerHTML).toBe(snapshot1);
  dispose();
});

test("hydrates and unmounts title", () => {
  hydrationScript();
  let div = document.createElement("div");
  document.head.innerHTML = `<title data-sm="0-0-0-0">Static</title>`;
  const snapshot1 = '<title data-sm="0-0-0-0">Static</title><title>Static</title>';
  const snapshot2 = '<title data-sm="0-0-0-0">Static</title><title>Dynamic</title>';
  const [visible, setVisible] = createSignal(false);
  const dispose = hydrate(
    () => (
      <MetaProvider>
        <Title>Static</Title>
        <Show when={visible()}>
          <Title>Dynamic</Title>
        </Show>
      </MetaProvider>
    ),
    div
  );

  expect(document.head.innerHTML).toBe(snapshot1);
  setVisible(true);
  expect(document.head.innerHTML).toBe(snapshot2);
  setVisible(false);
  expect(document.head.innerHTML).toBe(snapshot1);
  dispose();
  removeScript();
});

test("switches between titles", async () => {
  let div = document.createElement("div");
  const snapshot1 = "<title>Title 1</title>";
  const snapshot2 = "<title>Title 2</title>";
  const [visible, setVisible] = createSignal(true);

  const Comp1 = lazy(async () => ({
    default: function Comp() {
      return <Title>Title 1</Title>;
    }
  }));

  const Comp2 = lazy(async () => ({
    default: function Comp() {
      return <Title>Title 2</Title>;
    }
  }));

  const dispose = render(
    () => (
      <MetaProvider>
        <Title>Static</Title>
        <Show when={visible()} fallback={<Comp2 />}>
          <Comp1 />
        </Show>
      </MetaProvider>
    ),
    div
  );

  await new Promise(resolve => setTimeout(resolve, 1));
  expect(document.head.innerHTML).toBe(snapshot1);
  setVisible(false);
  await new Promise(resolve => setTimeout(resolve, 1));
  expect(document.head.innerHTML).toBe(snapshot2);
  dispose();
});

test("renders only the last meta with the same name", () => {
  let div = document.createElement("div");

  /* Something weird in this env
  const snapshot1 = "<meta>Static 1</meta><meta name=\"name1\">Static 2</meta>";
  const snapshot2 = "<meta>Static 1</meta><meta name=\"name1\">Dynamic 1</meta>";
  const snapshot3 = "<meta>Dynamic 2</meta><meta name=\"name1\">Dynamic 1</meta>";
  */

  const snapshot1 = '<meta><meta name="name1">';
  const snapshot2 = '<meta><meta name="name1">';
  const snapshot3 = '<meta name="name1"><meta>';

  const [visible1, setVisible1] = createSignal(false);
  const [visible2, setVisible2] = createSignal(false);
  const dispose = render(
    () => (
      <MetaProvider>
        <Meta>Static 1</Meta>
        <Meta name="name1">Static 2</Meta>
        <Show when={visible1()}>
          <Meta name="name1">Dynamic 1</Meta>
        </Show>
        <Show when={visible2()}>
          <Meta>Dynamic 2</Meta>
        </Show>
      </MetaProvider>
    ),
    div
  );
  expect(document.head.innerHTML).toBe(snapshot1);
  // mount first
  setVisible1(true);
  expect(document.head.innerHTML).toBe(snapshot2);
  // mount second
  setVisible2(true);
  expect(document.head.innerHTML).toBe(snapshot3);
  // unmount second
  setVisible2(false);
  // unmount first
  setVisible1(false);
  expect(document.head.innerHTML).toBe(snapshot1);
  dispose();
});

test("renders only last meta with the same property", () => {
  let div = document.createElement("div");
  // something weird with meta tag stringification in this env
  const snapshot = '<meta property="name1"><meta name="name2"><meta property="name3">';
  const dispose = render(
    () => (
      <MetaProvider>
        <Meta property="name1">Meta 1</Meta>
        <Meta property="name1">Meta 2</Meta>
        <Meta property="name2">Meta 3</Meta>
        <Meta name="name2">Meta 4</Meta>
        <Meta name="name3">Meta 5</Meta>
        <Meta property="name3">Meta 6</Meta>
      </MetaProvider>
    ),
    div
  );
  expect(document.head.innerHTML).toBe(snapshot);
  dispose();
});

test("renders both meta with the same name/property but different other attributes", () => {
  let div = document.createElement("div");
  const snapshot =
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000">';
  const dispose = render(
    () => (
      <MetaProvider>
        <Meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff" />
        <Meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000" />
      </MetaProvider>
    ),
    div
  );
  expect(document.head.innerHTML).toBe(snapshot);
  dispose();
});

test("throws error if head tag is rendered without MetaProvider", () => {
  expect(() => {
    let div = document.createElement("div");
    render(() => <Style>{`body {}`}</Style>, div);
  }).toThrowError(/<MetaProvider \/> should be in the tree/);
});

test("doesn't create any effect on removal", () => {
  let div = document.createElement("div");

  const [show, setShow] = createSignal(true);
  const showAndTest = () => {
    expect(getOwner()?.owner).toBeTruthy();
    return show();
  };

  const dispose = render(
    () => (
      <MetaProvider>
        <Show when={show()}>
          <Title>
            Something {showAndTest()} that forces the Solid compiler to create a memo here
          </Title>
        </Show>
      </MetaProvider>
    ),
    div
  );

  setShow(false);
  dispose();
});

test("Escaping the title tag", () => {
  let div = document.createElement("div");
  const snapshot =
    '<title>Hello&lt;/title&gt;&lt;script&gt;alert("inject");&lt;/script&gt;&lt;title&gt; World</title>';
  const dispose = render(
    () => (
      <MetaProvider>
        <div>
          <Title>{'Hello</title><script>alert("inject");</script><title> World'}</Title>
        </div>
      </MetaProvider>
    ),
    div
  );
  expect(document.head.innerHTML).toBe(snapshot);
  dispose();
});

test("Escaping the title meta", () => {
  let div = document.createElement("div");
  const snapshot = '<meta content="Text in &quot;quotes&quot;">';

  const dispose = render(
    () => (
      <MetaProvider>
        <div>
          <Meta content={'Text in "quotes"'} />
        </div>
      </MetaProvider>
    ),
    div
  );
  expect(document.head.innerHTML).toBe(snapshot);
  dispose();
});
