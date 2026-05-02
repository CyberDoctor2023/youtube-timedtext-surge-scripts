# Beta20 Scoped Diagnostics

## Goal

Fix beta19 overreach.

## Behavior

- Default `debug=translate` only replaces cues when a request has confirmed `tlang` metadata but translation fully fails or times out.
- `skipped=no-meta` no longer rewrites ordinary caption bodies by default.
- `debug=all` can still be enabled manually when specifically testing the request 302 / metadata chain.

