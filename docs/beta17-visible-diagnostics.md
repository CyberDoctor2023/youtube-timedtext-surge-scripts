# Beta17 Visible Diagnostics

## Goal

Make `skipped=no-meta` visible inside the YouTube subtitle layer during beta testing.

## Why

`skipped=no-meta` means the response script matched `/api/timedtext`, but it could not find the local metadata written by the request script from a previous `tlang` request. This usually means the chain broke before translation started.

## Behavior

- The response still includes `X-YT-AutoTrans: skipped=no-meta;diagnostic=body`.
- The first visible timedtext cue is replaced with a short diagnostic subtitle.
- This is beta-only debugging behavior and is meant to distinguish request/meta failures from Google translation failures.

