---
"@solidjs/meta": patch
---

Drop the `useHead` / `HeadTag` re-exports. The primitive belongs to
`@solidjs/web` (a required peer) — import it from there. Keeping a second
import path for the identical function only invited confusion about whether
they differ.
