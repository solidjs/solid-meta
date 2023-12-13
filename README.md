<p>
  <img width="100%" src="https://assets.solidjs.com/banner?project=Meta&type=core" alt="Solid Meta">
</p>

# Solid Meta [![npm Version](https://img.shields.io/npm/v/@solidjs/meta.svg?style=flat-square)](https://www.npmjs.org/package/@solidjs/meta)

Asynchronous SSR-ready Document Head management for Solid based on [React Head](https://github.com/tizmagik/react-head)

> For Solid 1.0 use 0.27.x or greater.
> For versions of Solid 0.x use 0.26.x.

## Motivation

This module allows you to define `document.head` tags anywhere in your component hierarchy. The motivations are similar to [react-helmet](https://github.com/nfl/react-helmet) in that you may only have the information for certain tags contextually deep in your component hiearchy. There are no dependencies and it should work fine with asynchronous rendering.

## Installation

```sh
npm i @solidjs/meta
```

## How it works

1.  You wrap your App with `<MetaProvider />`
2.  To insert head tags within your app, just render one of `<Title />`, `<Meta />`, `<Style />`, `<Link />`, and `<Base />` components as often as needed.
3. One the server if you render the `<head>` element using SolidJS in JSX you are all good. Otherwise use `getAssets` from `solid-js/web` to insert the assets where you want.

On the server, the tags are collected, and then on the client the server-generated tags are removed in favor of the client-rendered tags so that SPAs still work as expected (e.g. in cases where subsequent page loads need to change the head tags).

### Server setup

Wrap your app with `<MetaProvider />` on the server, using a `tags[]` array to pass down as part of your server-rendered payload. When rendered, the component mutates this array to contain the tags.

```js
import { renderToString, getAssets } from 'solid-js/web';
import { MetaProvider } from '@solidjs/meta';
import App from './App';

// ... within the context of a request ...
const app = renderToString(() =>
  <MetaProvider>
    <App />
  </MetaProvider>
);

res.send(`
  <!doctype html>
  <html>
    <head>
      ${getAssets()}
    </head>
    <body>
      <div id="root">${app}</div>
    </body>
  </html>
`);
```

### Client setup

There is nothing special required on the client, just render one of head tag components whenever you want to inject a tag in the `<head />`.

```js
import { MetaProvider, Title, Link, Meta } from '@solidjs/meta';

const App = () => (
  <MetaProvider>
    <div class="Home">
      <Title>Title of page</Title>
      <Link rel="canonical" href="http://solidjs.com/" />
      <Meta name="example" content="whatever" />
      // ...
    </div>
  </MetaProvider>
);
```
