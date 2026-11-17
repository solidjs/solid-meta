---
"@solidjs/meta": patch
---

`<Head>` no longer writes a signal during server render, so dev SSR stops logging `[SERVER_WRITE]` for every page that uses it (#80). The server reads the group's tags when its boundary flushes, so the write did nothing there.
