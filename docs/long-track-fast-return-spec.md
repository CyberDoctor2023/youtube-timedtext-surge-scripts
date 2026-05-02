# Long-Track Fast Return Spec

## Goal

Make long YouTube iOS timedtext responses complete the Surge response script path more reliably. The first success criterion is seeing `X-YT-AutoTrans` on long or chunked timedtext responses, even if the first response only contains cached or partial translations.

## Non-Goals

- Do not change the request-side `tlang` removal and local 302 design.
- Do not try to translate an entire one-hour-plus subtitle track in one foreground response.
- Do not solve YouTube's in-app subtitle cache behavior without a normal overseas reference capture.

## Completion Conditions

- The production module points to the `main` branch and carries the release version.
- Long or chunked timedtext responses allow a larger body size than the default 2MB script limit.
- Long responses use a bounded foreground translation budget and return a diagnostic header instead of silently falling through.
- Normal shorter tracks keep the existing translation and self-reload behavior.

## Validation Plan

- Run JavaScript syntax checks for request and response scripts.
- Run `surge-cli --check` with a complete temporary profile.
- Inspect long-video `/api/timedtext` response headers for `X-YT-AutoTrans`.
