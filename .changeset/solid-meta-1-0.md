---
"@solidjs/meta": major
---

Solid Meta 1.0: rebuilt as a thin layer over Solid 2.0's `useHead` primitive.

- **Provider-less**: the head registry is ambient. `MetaProvider` and
  `MetaContext` are gone — remove the wrapper and the `tags={[]}` SSR
  plumbing; on the server, head tags are spliced into `<head>` automatically
  by `renderToString`/`renderToStream` (or collected via the `onHead` render
  option).
- **New components**: `<Head>` groups its child tags into one replacement
  set (several `og:image`s that override as a unit and restore on disposal);
  `<Script>` covers JSON-LD and other head scripts.
- **New semantics from the core registry**: identity-based deduplication
  with last-committed-wins and restore-on-disposal, `key` to override
  identity, streaming-correct SSR patches that ride suspense reveals, and
  flicker-free hydration adoption.
- **Removed**: the legacy `useHead(TagDescription)` shim (the re-exported
  core `useHead(HeadTag | HeadTag[] | () => HeadTag[])` replaces it),
  `escape` prop (everything is escaped; text is applied via `textContent`),
  `ref`/event handlers on head tags, and client-dynamic `<Base>` /
  `<Meta charset>` (shell-only on the server, ignored with a dev warning on
  the client).
- **Peer dependencies**: requires `solid-js` `>=2.0.0-beta.30` and
  `@solidjs/web` `>=2.0.0-beta.31` (the first beta with reactive `useHead`
  groups, media-qualified meta identity, and replaceable icons). For Solid
  1.x stay on `@solidjs/meta` 0.29.x; for Solid 0.x, 0.26.x.

See the README migration guide for a 0.x → 1.0 walkthrough.
