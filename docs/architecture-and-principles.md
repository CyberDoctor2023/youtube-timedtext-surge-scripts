# Architecture and Principles

## Problem

The native YouTube app on iOS requests auto-translated timedtext with a URL like:

```text
https://www.youtube.com/api/timedtext?...&lang=en&tlang=zh-Hant&format=srv3
```

In the affected proxy environments, sending `tlang` to YouTube timedtext can trigger `HTTP 429 Too Many Requests`. The same video often works through clean overseas SIM traffic or clean VPS exits, so the failure is tied to YouTube timedtext, target-language translation, and exit-IP reputation.

## Current Stable Design

```text
1. YouTube App requests /api/timedtext?...&lang=en&tlang=TARGET
2. Surge request script sees tlang before YouTube receives it
3. Script stores short-lived metadata for the exact clean URL
4. Script returns local 302 Location: clean URL without tlang
5. YouTube App follows the clean URL
6. YouTube returns source timedtext XML instead of 429
7. Surge response script recovers target language from metadata
8. Script translates XML locally and returns modified timedtext
```

The original risky request is never sent upstream. YouTube only sees the clean source-caption timedtext request.

## Why Not Pure URL Rewrite?

URL Rewrite can remove `tlang` reliably:

```text
/api/timedtext?...&lang=en&tlang=zh-Hant&format=srv3
  -> /api/timedtext?...&lang=en&format=srv3
```

But after the redirect, the response phase only sees the clean URL. It no longer knows whether the user asked for Chinese, Japanese, Indonesian, Spanish, or just normal English captions. That makes it unsuitable for a global module.

The early stable rewrite-only approach was useful because it proved that deleting `tlang` avoids YouTube 429, but it cannot preserve target-language intent.

## Why Local 302 Instead of `$done({ url })`?

Direct request URL mutation was tested and found unreliable in this timedtext path. A local 302 is explicit:

- the risky `tlang` request is stopped locally;
- metadata is written before the clean request is issued;
- YouTube App naturally follows the clean URL;
- the response script can map clean response back to the saved target language.

## Metadata Scope

The safe rule is:

```text
Translate only the immediate clean response that follows a captured tlang request.
```

Broad state such as `videoId -> lastTargetLanguage` is dangerous because users can later select normal English CC for the same video. That clean English request should remain English, not inherit an old auto-translate target.

The implementation therefore stores metadata by exact/canonical clean URL and consumes narrow intent quickly.

## TimedText XML Strategy

The response script keeps YouTube's timedtext shell and replaces only visible cue text:

- preserve `<timedtext>`, `<head>`, `<body>`, `<p>` timing attributes;
- parse visible text from `<s>` nodes;
- encode bilingual line breaks as `&#x000A;`;
- avoid reconstructing a new incompatible XML format.

For ASR captions, the script also normalizes roll-up/left-window behavior toward centered captions and clamps overlapping durations where needed.

## Translation Strategy

The default provider is:

```text
https://translate.googleapis.com/translate_a/single?client=gtx
```

It has no project API key and no private quota. Google may rate-limit or redirect a dirty exit IP to `google.com/sorry`. That is an IP/reputation failure, not a repository-wide key failure.

The script uses:

- batching with markers;
- POST first for larger payloads;
- GET fallback for failed POST chunks;
- counters for `postSorry`, `getRedirect`, `postParse`, `markerMiss`, and related states;
- subtitle-body diagnostics when a confirmed translation request fully fails.

## Why Not Azure or DeepL by Default?

Official Azure Translator and DeepL APIs require authentication. A public Surge module cannot safely ship a shared API key. Users can eventually add a private gateway, but the public module must not embed paid credentials.

Unofficial public endpoints may exist, but they are not stable or ethical enough to present as supported defaults.

## Foreground Response Boundary

Surge `http-response` scripts must eventually call `$done(...)`. They cannot keep a timedtext HTTP response open indefinitely, stream partial subtitle lines, and later patch already-delivered subtitles.

That means this module has to finish inside the YouTube app's foreground subtitle loading window. Real captures showed app-side disconnects around the 8-second active mark, so the implementation returns bounded results and visible diagnostics instead of waiting forever.

## Long-Video Boundary

Official YouTube auto-translation can return a complete translated timedtext XML for over-one-hour `variant=gemini` ASR tracks when the network and exit IP are trusted.

The local workaround is harder because it removes `tlang`, then asks Google Translate to translate locally under a foreground response budget. Large tracks stress:

- Surge response body limits;
- Google request count and anti-automation behavior;
- YouTube in-app caption cache;
- the one-shot `$done` response model.

This is why long videos have the most known edge cases.
