<p>
  <img width="100%" src="https://assets.solidjs.com/banner?project=Meta&type=core" alt="Solid Meta">
</p>

# Solid Meta [![npm Version](https://img.shields.io/npm/v/@solidjs/meta.svg?style=flat-square)](https://www.npmjs.org/package/@solidjs/meta)

Document head management for Solid — declare `<title>`, `<meta>`, `<link>`, and friends anywhere in your component tree, with streaming-correct SSR and flicker-free hydration.

> | Solid version | @solidjs/meta version |
> | --- | --- |
> | Solid 2.x | 1.x |
> | Solid 1.x | 0.27.x – 0.29.x |
> | Solid 0.x | 0.26.x |

## Installation

```sh
npm i @solidjs/meta
```

## How it works

Solid Meta 1.x is a thin component layer over Solid 2.0's built-in head
registry (`useHead` in `@solidjs/web`). There is **no provider** — the
registry is ambient. Render a head component anywhere and it registers under
the current reactive owner:

```jsx
import { Title, Link, Meta } from "@solidjs/meta";

const Home = () => (
  <div class="Home">
    <Title>Title of page</Title>
    <Link rel="canonical" href="https://solidjs.com/" />
    <Meta name="description" content="A description of this page" />
  </div>
);
```

- **Later wins.** Tags deduplicate by identity (see below); the
  last-registered tag for an identity is the one in the document.
- **Disposal restores.** When the winning tag's component unmounts, the
  previous registration for that identity is restored — navigating away from
  a page undoes its head changes automatically.
- **Reactive.** Attribute values and text children can be reactive
  expressions; updates apply in place without losing the tag's position in
  the override order.
- **SSR is automatic.** `renderToString` / `renderToStream` splice the
  winning tags into your document's `<head>`. Tags registered under a
  suspense boundary stream to the client as patches that apply when the
  boundary reveals. No `getAssets()`, no tags array.
- **Hydration adopts.** Server-rendered head tags are claimed in place on
  hydration — no removal/re-insertion flicker.

### Components

| Component | Notes |
| --- | --- |
| `<Title>` | Document title. Hard singleton: the last one wins, unmounting restores the previous (a static `<title>` in your HTML shell is the final fallback). |
| `<Meta>` | Dedupes by `name`, `property`, or `http-equiv` — these are separate namespaces (`name="og:image"` and `property="og:image"` coexist). A `media` attribute forks identity, so `theme-color` light/dark variants coexist. |
| `<Link>` | Dedupes by `rel` + `href`. Icons (`rel="icon"` / `rel="apple-touch-icon"`) dedupe by `rel` + `sizes` + `type` instead — swapping the `href` *replaces* the favicon rather than accumulating. Resource rels (`preload`, `modulepreload`, `prefetch`, `preconnect`, `dns-prefetch`) render immediately and are never retracted. |
| `<Stylesheet>` | Sugar for `<Link rel="stylesheet">`. Emitted eagerly (SSR streams it as soon as it registers); removed when its owner disposes. |
| `<Style>` | Inline style body. Keyless instances append; give a `key` to make one replaceable. |
| `<Script>` | Head scripts, including inline bodies — JSON-LD (`type="application/ld+json"`) is the marquee use case. `src` scripts dedupe by URL; keyless inline bodies append. |
| `<Base>` | Server shell only: rendered into the head prelude on first flush. Ignored (with a dev warning) on the client — a base that changes after relative URLs resolved is incoherent. Same for `<Meta charset>`. |
| `<Head>` | Groups its children into one replacement set — see below. |

Every component accepts a `key` prop that overrides the default identity —
use it to make otherwise-distinct tags override each other, or to fork an
identity that would otherwise collide:

```jsx
{/* These override each other despite different attributes: */}
<Meta key="social-image" name="twitter:image" content="/twitter.png" />
<Meta key="social-image" property="og:image" content="/og.png" />
```

### `<Head>` groups

Some head state is a *set*, not a single tag — multiple `og:image`s, a block
of social tags that should override together. `<Head>` groups its child tags
into one replacement set: within the group, same-identity tags coexist; a
later group replaces an earlier group's set for an identity wholesale, and
unmounting restores it.

```jsx
// Layout
<Head>
  <Meta property="og:image" content="/default-1.png" />
  <Meta property="og:image" content="/default-2.png" />
</Head>

// Page — replaces BOTH defaults while mounted, restores them on leave
<Head>
  <Meta property="og:image" content={product().image} />
</Head>
```

Group membership is reactive — tags rendered conditionally (or by child
components) inside a `<Head>` join and leave the set as they mount and
unmount. A `<Head>` nested inside another `<Head>`'s children forms its own
independent group; to contribute tags *into* the surrounding group, render
bare tag components instead.

### Server setup

Render your document with Solid and the head manages itself:

```jsx
import { renderToStream } from "@solidjs/web";
import App from "./App";

// ... within the context of a request ...
renderToStream(() => <App />).pipe(res);
```

Winning tags are spliced into `<head>` on the first flush (`<base>` and
`<meta charset>` go right after `<head>` opens; resource links go early).
Tags from suspense boundaries that complete later stream as patches. If you
assemble the document yourself, use the `onHead` render option to receive
the head markup instead.

> [!IMPORTANT]
> A static `<title>` in your server shell acts as the fallback when no
> `<Title>` is mounted. Don't hardcode other tags that Solid Meta should
> manage — the registry leaves foreign head tags alone, so a hardcoded
> `<meta name="description">` would coexist with a rendered one.

### Escape hatch: `useHead`

The core primitive is re-exported for library authors (routers, CSS-in-JS
collectors, SEO policy layers):

```jsx
import { useHead } from "@solidjs/meta"; // same as from "@solidjs/web"

useHead({ tag: "meta", props: { name: "description", content: () => desc() } });
useHead([ /* an array is a group — one replacement set */ ]);
useHead(() => tags()); // a function is a reactive group
```

## Migrating from 0.x

1. **Delete `<MetaProvider>`.** The registry is ambient; the provider and
   `MetaContext` no longer exist.
2. **Delete server plumbing.** No more `tags={[]}` array and no
   `getAssets()` — rendering the document splices the head automatically
   (use the `onHead` render option if you assemble HTML yourself).
3. **Duplicate-tag semantics changed.** 0.x kept multiple `<Meta>`s with the
   same `name` if their other attributes differed; 1.x dedupes by
   `name`/`property`/`http-equiv` (+ `media`) with last-wins. For deliberate
   sets (multiple `og:image`s), wrap them in `<Head>`; to fork an identity,
   give each tag a distinct `key`.
4. **`useHead` changed shape.** The 0.x `useHead(TagDescription)` shim is
   gone; the re-exported core `useHead` takes `HeadTag | HeadTag[] |
   (() => HeadTag[])` descriptors (`{ tag, props, key? }`).
5. **Removed niceties:**
   - `escape` prop — everything is escaped now; text applies via
     `textContent`, so markup injection isn't possible.
   - `ref` and event handlers on head tags — head tags are data, not managed
     elements. Query the DOM directly for the rare case that needs it.
   - Client-dynamic `<Base>` / `<Meta charset>` — shell-only on the server,
     warned and ignored on the client.
   - `noscript` — never a first-class tag here, and excluded from the core
     union: author it statically in your document shell.
6. **`<Script>` is new** — JSON-LD and other head scripts no longer need the
   `useHead` escape hatch.
