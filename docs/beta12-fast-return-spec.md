# beta12 long-track fast return spec

## Goal

Make long YouTube iOS timedtext responses complete the Surge response script path more reliably. The first success criterion is seeing `X-YT-AutoTrans` on long or chunked timedtext responses, even if the first response only contains cached or partial translations.

## Non-goals

- Do not change the request-side `tlang` removal and local 302 design.
- Do not try to translate an entire one-hour-plus subtitle track in one foreground response.
- Do not change the formal `main` release module.

## Completion Conditions

- The beta module points to the `beta` branch and carries `version=beta12`.
- Long or chunked timedtext responses use a shorter foreground budget.
- Long responses skip self-reload on the same response and return a diagnostic header instead.
- Normal shorter tracks keep the existing translation and self-reload behavior.

## Validation Plan

- Run JavaScript syntax checks for request and response scripts.
- Run `surge-cli --check` with a complete temporary profile.
- Install the beta module on iOS Surge and inspect long-video `/api/timedtext` response headers for `X-YT-AutoTrans`.
