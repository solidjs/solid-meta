---
"@solidjs/meta": patch
---

Add a `solid` export condition so `@solidjs/vite-plugin` (through vitefu) bundles `@solidjs/meta` in SSR instead of leaving it external. Left external, Node loaded it against the production `solid-js` server build while the app ran on the dev build, and the two owner stacks threw `NoOwnerError` in dev SSR (#74).
