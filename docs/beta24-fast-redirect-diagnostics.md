# Beta24 Fast Redirect Diagnostics

## Goal

Avoid YouTube timeout flicker after Google Translate starts returning `google.com/sorry` or other 3xx redirects.

## Behavior

- POST `Sorry` does not immediately fail the subtitle response. The script still waits for the GET fallback for that same chunk.
- If the GET fallback records `getSorry` or `getRedirect` before any usable translation is applied, the response completes immediately with `status=translate redirect`.
- Network timeout still reports `status=translate timeout`; request errors remain visible through `postError` / `getError`.
- With default `debug=translate`, every cue is replaced with the translation failure diagnostic text.
- This keeps the response inside YouTube's subtitle loading window instead of waiting for the full long-track budget.
