---
"@solidjs/meta": patch
---

Update `solid-js` / `@solidjs/web` to `2.0.0-rc.0` and move the peer ranges from `>=2.0.0-beta.30 <2.0.0` / `>=2.0.0-beta.31 <2.0.0` to `^2.0.0-rc.0`. The old ranges admitted the hazardous `2.0.0-experimental.*` publishes (which sort between beta and rc) and excluded stable `2.0.0`; the caret floors above the experimentals and auto-graduates to stable 2.x.
