# Beta22 Failure Counters

## Goal

Keep default all-cue diagnostics for confirmed translation failures, but make `fail=N` explainable.

## Header Counters

- `postError`, `postHttp`, `postEmpty`, `postParse`
- `getError`, `getHttp`, `getEmpty`, `getParse`, `getParts`
- `markerMiss`

## Interpretation

Surge may show a Google Translate request as completed, while the script still cannot use it. For example, a `200 OK` response with no parseable Google JSON becomes `postParse`, and a response with parseable JSON but empty translated text becomes `postEmpty`.

