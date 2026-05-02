# Beta19 All-Cue Diagnostics

## Goal

Make diagnostic states visible at every playback position during beta testing.

## Behavior

- `skipped=no-meta` replaces every visible cue with the no-meta diagnostic text.
- Long-track `translate failed` or `translate timeout` replaces every parsed cue with the translation failure diagnostic text.
- Headers include `diagnostic=all-cues`.

## 302 Clarification

The request-side 302 is still required because it removes `tlang` before YouTube receives the request, avoiding the timedtext 429 path while preserving the target language in local metadata. The self-reload 302 is separate and remains disabled for long tracks.

