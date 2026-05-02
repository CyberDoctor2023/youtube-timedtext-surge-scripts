# beta15 Translation Intent and Batching

## Goal

Improve long-video translation coverage while preventing normal English CC requests from being translated accidentally.

## Changes

- Use Google Translate `POST` requests so subtitle chunks are no longer constrained by GET URL length.
- Increase long-track translation concurrency from 4 to 8.
- Increase per-request translation body limits for larger chunks.
- Stop writing and reading broad track-level target-language metadata.
- Consume exact/canonical `tlang` intent metadata after the clean timedtext response is completed.
- Clean speaker markers such as `>>`, `<<`, `＞＞`, and `＜＜` from source and translated subtitle text.

## Design Notes

Official overseas-SIM captures show that YouTube's successful auto-translate path is strictly driven by the original `tlang` parameter. A clean `/api/timedtext?...&lang=en&format=srv3` request should therefore remain a source-language CC request unless it is the immediate redirected follow-up of a captured `tlang` request.

Translation cache can remain long-lived, but translation intent metadata must be narrow and short-lived.

## Validation Plan

- Select auto-translate and confirm `/api/timedtext?...&tlang=...` is redirected to a clean URL and translated.
- Select English CC after using auto-translate and confirm the clean English track is not translated.
- Test a long `variant=gemini` ASR video and compare `X-YT-AutoTrans` `requested`, `ok`, and `missing` fields against beta14.
