# Troubleshooting and Captures

This document records the practical failure modes discovered through Surge iOS packet captures.

## 1. YouTube TimedText 429

### Symptom

YouTube app shows:

```text
加载字幕时出错
```

Surge response header shows:

```text
HTTP/1.1 429 Too Many Requests
Content-Type: text/html; charset=UTF-8
Server: video-timedtext
```

### Interpretation

The failing request contains `tlang`, for example:

```text
/api/timedtext?...&lang=en&tlang=zh-Hant&format=srv3
```

On dirty or sensitive proxy exits, YouTube timedtext rejects that translated request. Removing `tlang` avoids the 429, but then target-language intent must be preserved locally.

## 2. Clean Source Request Works

### Symptom

The same timedtext request without `tlang` returns:

```text
HTTP/1.1 200 OK
Content-Type: text/xml; charset=UTF-8
Server: video-timedtext
```

### Interpretation

The video has a usable source subtitle track. The failure is not "no subtitle exists"; it is the `tlang` auto-translate path.

## 3. Google Sorry / Anti-Automation

### Symptom

Surge may show the Google Translate request as completed, but the response is:

```text
HTTP/2 302
location: https://www.google.com/sorry/index?continue=https://translate.googleapis.com/...
```

### Interpretation

This is not a valid translation response. Google accepted the HTTP connection but redirected the request to an anti-automation page.

The module records this as:

- `postSorry`
- `getSorry`
- status such as `translate redirect`
- subtitle text: `Google Sorry / 风控`

### Why Changing Nodes May Still Fail

The public `translate.googleapis.com` gtx endpoint has no private API key. Google mostly sees the exit IP and request pattern. If the next proxy node is also a shared/dirty exit, it can still be redirected to Sorry.

Other users are affected only if they share the same dirty exit IP or similar request pattern. This is not a global repository key being blocked.

## 4. Translation Timeout

### Symptom

YouTube returns `200 OK`, but the app closes the subtitle request after a long active time. Captures showed `Active` near 8 seconds:

```text
Active 7945.0 ms
Disconnect: Closed by client
```

### Interpretation

YouTube delivered source XML, but the response script did not finish translation quickly enough for the YouTube app.

The module now uses bounded budgets and visible diagnostic subtitles:

```text
[YT AutoTrans] 翻译超时
已拿到 YouTube 字幕，但翻译请求在预算内没有完成。
请检查节点速度或稍后重试。
```

## 5. No Metadata

### Symptom

Header contains:

```text
X-YT-AutoTrans: skipped=no-meta
```

### Interpretation

The response script matched `/api/timedtext`, but it did not find metadata from a previous `tlang` request. Common causes:

- user selected normal English CC, not auto-translate;
- another module or rewrite removed `tlang` before this module saw it;
- YouTube reused an internal clean-caption request without asking for translation;
- metadata expired before the clean response arrived.

Default `debug=translate` does not overwrite normal no-meta captions. `debug=all` can be enabled only when actively debugging this path.

## 6. English Captions After a Flash

### Symptom

The subtitle appears to reload, then remains English.

### Interpretation

There are several possible causes:

- no metadata, so the response is treated as normal English;
- Google translation failed and debug was off;
- YouTube app reused an in-memory English caption cache;
- the response body exceeded earlier script limits;
- the long-track response path returned before new translations were cached.

Look at `X-YT-AutoTrans` first. It is more reliable than the visual flash.

## 7. Large / Long Video Cases

Observed examples:

- one-hour-plus `variant=gemini` ASR tracks;
- response body near or above 2MB before `max-size` was raised;
- nine-hour videos with `Content-Length` above 3MB;
- `Transfer-Encoding: chunked` official responses.

Important conclusion from overseas SIM captures:

YouTube official auto-translation still uses the same `/api/timedtext?...&tlang=...` endpoint and can return full translated XML through one response. There is no separate magic endpoint for long videos in the successful official path.

The difficulty is local translation under Surge's foreground response budget.

## 8. POST vs GET Translate

POST was added to reduce Google GET URL-length pressure for larger batches. It is not a guaranteed bypass for Google risk controls.

Current behavior:

- try POST first;
- if POST fails, split into GET-safe parts;
- distinguish network errors, HTTP errors, redirects, Sorry pages, parse failures, empty results, and marker misses.

## 9. Debug Headers

Useful `X-YT-AutoTrans` fields:

```text
items=...
long=...
cached=...
requested=...
ok=...
fail=...
missing=...
postSorry=...
getSorry=...
postRedirect=...
getRedirect=...
postParse=...
getParse=...
markerMiss=...
status=...
diagnostic=...
```

High-level interpretation:

- `missing` high, `ok=0`: no usable translations were applied.
- `postSorry/getSorry`: Google anti-automation.
- `postRedirect/getRedirect`: Google returned a redirect, not JSON.
- `postParse/getParse`: body was not expected Google JSON.
- `markerMiss`: translation text came back but markers were changed.
- `skipped=no-meta`: translation intent was not available for that response.

## 10. Screenshots

These assets are kept in the repository:

- `assets/youtube-subtitle-error.jpg`: YouTube app visible subtitle error.
- `assets/surge-429-response.png`: Surge timedtext 429 response.
- `assets/surge-active-timeout.jpg`: Surge active-time timeout evidence.

They are referenced from README so ordinary users can match symptoms quickly.
