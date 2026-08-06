---
"@solidjs/meta": patch
---

Fix hydration id drift from dynamic Title/Style/Script bodies

Compiled JSX children (e.g. `<Title>Page {site()}</Title>`) can allocate a
computation when read. The head registry evaluates descriptor getters at
runtime-dependent points — the registry effect on the client, stream flush on
the server — so that allocation landed under different owners on each runtime
and drifted every hydration id assigned after it, breaking claims for content
rendered after the tag (most visibly under a streamed `Loading` boundary).

`headTag` now pins the body in a memo created at registration, under the
component, at the same point on both runtimes; the descriptor getter is a pure
read. Adds an SSR -> hydrate parity harness covering sync, root-async, and
boundary-async Title bodies.
