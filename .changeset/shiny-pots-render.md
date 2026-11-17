---
"@solidjs/meta": patch
---

Render nullish children as an empty tag during SSR instead of the literal string `"undefined"`. `escape` passes non-string values through untouched, so `<Title>{value?.title}</Title>` emitted `<title>undefined</title>` when `value` had not resolved yet.
