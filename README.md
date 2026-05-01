# YouTube TimedText Surge Scripts

Surge scripts for fixing YouTube iOS App auto-translated subtitles when `/api/timedtext` requests with `tlang` return HTTP 429.

The current solution has been verified with YouTube iOS timedtext traffic:

- original translated subtitle request contains `lang=<source>&tlang=<target>`;
- the first request is intercepted locally and never sent to YouTube;
- Surge returns a local `302` to the same timedtext URL without `tlang`;
- YouTube receives only the clean URL and returns the original subtitle XML;
- the response script translates the timedtext XML locally to the original `tlang`;
- ordinary subtitle requests without `tlang` are left untouched.

## Background

YouTube's subtitle auto-translate path commonly requests:

```text
https://www.youtube.com/api/timedtext?...&lang=en&tlang=zh-Hans&format=srv3
```

In affected environments, the final request containing `tlang` receives:

```text
HTTP/1.1 429 Too Many Requests
```

This has been especially reproducible in China-mainland-facing proxy or airport environments, where YouTube timedtext auto-translation requests routed through certain exit IPs appear to be rate-limited or rejected even when normal subtitle requests still work. The practical symptom is simple: original-language subtitles load, but auto-translated subtitles fail.

This is not an isolated local configuration problem. Users have reported broken YouTube auto-translated subtitles across countries, devices, and apps. A ReVanced Extended issue also documents that unpatched YouTube auto-translated subtitle requests with the `tlang` query parameter can return 429, even when a normal rate limit has not actually been reached.

## References

- YouTube Help Community: [Auto-translated subtitles issue thread](https://support.google.com/youtube/thread/368737344?sjid=5480931985540789392-NC)
- Reddit: [Auto translated subtitles no longer work?](https://www.reddit.com/r/youtube/comments/1meu9kx/auto_translated_subtitles_no_longer_work/)
- Reddit: [Anyone else having trouble with auto translated subtitles?](https://www.reddit.com/r/youtube/comments/1n0kvr6/anyone_else_having_trouble_with_auto_translated/)
- Reddit: [Subtitle auto translate not showing](https://www.reddit.com/r/youtube/comments/1n2b8g1/subtitle_auto_translate_english_not_showing_in/)
- GitHub: [ReVanced Extended issue #3147](https://github.com/inotia00/ReVanced_Extended/issues/3147)

Important outside observations:

- Reddit users report auto-translate failures in many regions and on iOS/desktop/browser variants.
- ReVanced Extended issue #3147 describes `tlang` timedtext auto-translation requests returning 429 and proposes fixing Android by adding transcript cookies.
- This repository solves the Surge/iOS proxy use case differently: it prevents YouTube from seeing `tlang` at all, while preserving `tlang` locally for response translation.

## Why URL Rewrite Alone Is Not Enough

A pure Surge `[URL Rewrite]` rule can remove `tlang`:

```ini
^https:\/\/www\.youtube\.com\/api\/timedtext\?(.*)&tlang=[^&]+&(.*) https://www.youtube.com/api/timedtext?$1&$2 302
```

That avoids the 429 because the second request sent to YouTube no longer contains `tlang`.

However, it has a fatal product problem:

```text
request 1: /api/timedtext?...&lang=en&tlang=ja
Surge:    302 to /api/timedtext?...&lang=en
request 2: /api/timedtext?...&lang=en
response script sees only request 2
```

After the 302, the response script no longer knows whether the user asked for Japanese, Chinese, Spanish, German, or any other target language. The only visible URL is the clean URL.

That makes pure rewrite suitable only for a hard-coded target language or for "translate every subtitle" experiments. It is not suitable for a global product where the YouTube client must decide the target language.

## Why Request URL Mutation Was Rejected

The unreliable approach is:

```javascript
$done({ url: cleanUrl });
```

This asks Surge to modify the current request and continue sending it upstream. In testing, this class of request script was not reliable enough for the YouTube timedtext 429 path: logs could show a request script match while the final traffic still failed or state did not reach the response phase reliably.

The current solution does not use that approach.

## The Current Design

The working design is:

```text
1. YouTube App requests:
   /api/timedtext?...&lang=en&tlang=ja&format=srv3

2. youtube_timedtext_request.js:
   - reads lang=en and tlang=ja
   - deletes tlang from a cloned URL
   - stores metadata:
     cleanUrl -> { sourceLang: "en", targetLang: "ja" }
   - returns a local 302 response:
     Location: cleanUrl

3. YouTube App follows the 302:
   /api/timedtext?...&lang=en&format=srv3

4. YouTube receives only the clean URL:
   no tlang, no 429

5. youtube_timedtext_response.js:
   - reads metadata by clean URL
   - if no metadata exists, leaves the response untouched
   - parses timedtext XML
   - extracts text from srv3 `<s>` nodes
   - translates sourceLang -> targetLang
   - writes translated text back into each `<p>`
```

The key distinction:

```javascript
// Rejected: mutate current request and send it upstream.
$done({ url: cleanUrl });

// Current: do not send the original request upstream.
// Return a local redirect, like a programmable rewrite.
$done({
  response: {
    status: 302,
    headers: { Location: cleanUrl },
    body: ""
  }
});
```

## Why This Works

It satisfies all required constraints:

- YouTube never sees `tlang`, so the timedtext 429 trigger is avoided.
- The original `tlang` is preserved locally before redirect.
- The response script only translates when matching metadata exists.
- Ordinary subtitle requests are not translated.
- The target language is chosen by the YouTube client, not hard-coded by the script.
- The solution works for global users, for example:

```text
lang=en&tlang=ja       English -> Japanese
lang=ko&tlang=en       Korean -> English
lang=es&tlang=zh-CN    Spanish -> Chinese
lang=fr&tlang=de       French -> German
```

## Surge Configuration

Do not keep old timedtext URL Rewrite rules. The request script must see `tlang`.

Use:

```ini
[Script]
youtube-timedtext-request = type=http-request,pattern=^https:\/\/www\.youtube\.com\/api\/timedtext\?.*tlang=,timeout=5,script-path=https://raw.githubusercontent.com/CyberDoctor2023/youtube-timedtext-surge-scripts/main/youtube_timedtext_request.js
youtube-timedtext-response = type=http-response,pattern=^https:\/\/www\.youtube\.com\/api\/timedtext\?,requires-body=true,max-size=2097152,timeout=60,script-path=https://raw.githubusercontent.com/CyberDoctor2023/youtube-timedtext-surge-scripts/main/youtube_timedtext_response.js

[MITM]
hostname = %APPEND% www.youtube.com
```

Remove old rules like:

```ini
[URL Rewrite]
^https:\/\/www\.youtube\.com\/api\/timedtext\?tlang=[^&]+&(.*) https://www.youtube.com/api/timedtext?$1 302
^https:\/\/www\.youtube\.com\/api\/timedtext\?(.*)&tlang=[^&]+&(.*) https://www.youtube.com/api/timedtext?$1&$2 302
^https:\/\/www\.youtube\.com\/api\/timedtext\?(.*)&tlang=[^&]+$ https://www.youtube.com/api/timedtext?$1 302
```

Those rewrite rules are replaced by the request script's local 302.

## Surge CLI Verification

The local Surge CLI manual says to use `--help` for the latest manual:

```bash
/Applications/Surge.app/Contents/Applications/surge-cli --help
```

Relevant commands from the current local manual:

```text
dump profile [original / effective] - Show the original profile and the effective profile modified by modules
watch request - Keep tracing the new requests
script evaluate <script-js-path> [mock-script-type] [timeout] - Load a script from a file and evaluate
--check/-c <path> - Check whether a profile is valid.
```

Recommended checks:

```bash
/Applications/Surge.app/Contents/Applications/surge-cli --check <profile-or-module-path>
/Applications/Surge.app/Contents/Applications/surge-cli dump profile effective
/Applications/Surge.app/Contents/Applications/surge-cli watch request
```

Expected logs:

```text
YouTube timedtext redirect cached: en -> ja
YouTube timedtext translated: x/y
```

Expected traffic:

```text
Original client request contains: &tlang=<target>
Final upstream YouTube request does not contain: tlang
Upstream timedtext response is: 200 OK
```

## TimedText XML Handling

YouTube iOS often returns srv3 XML:

```xml
<p t="160" d="4560" w="1">
  <s ac="0">Welcome</s><s t="320" ac="0"> to</s>
</p>
```

The response script:

- preserves the surrounding timedtext XML;
- preserves `<p>` timing attributes such as `t`, `d`, `w`, and `a`;
- leaves empty spacer paragraphs unchanged;
- extracts text from all nested `<s>` nodes;
- writes the translated line back as a single `<s ac="0">...</s>`.

Example output:

```xml
<p t="160" d="4560" w="1"><s ac="0">ようこそ...</s></p>
```

The script intentionally does not preserve every original `<s t="...">` word segment. Word-level timing from English does not map cleanly to Chinese, Japanese, Korean, or other translated text. Keeping paragraph timing is much safer for app compatibility.

## Caching Strategy

There are two cache layers:

### 1. Redirect metadata cache

Written by `youtube_timedtext_request.js`:

```text
cleanUrl -> { sourceLang, targetLang, expiresAt }
```

This cache is short-lived. It exists so the response script can recover the target language after the client follows the 302.

### 2. Translation cache

Written by `youtube_timedtext_response.js`:

```text
cleanUrl + targetLang -> translated paragraph map
```

This cache lasts longer and allows progressive improvement for long videos. A single response script cannot stream partial subtitles to the app; Surge response scripting loads the complete body and returns it once. Therefore the practical strategy is:

- use cached translations immediately;
- translate a bounded amount per response;
- store translated paragraphs;
- subsequent requests for the same video and target language become more complete.

This avoids blocking the YouTube App for too long on very long subtitle files.

## Why Not Stream Partial Subtitles?

Surge `http-response` scripts with `requires-body=true` operate on a completed response body. The script must call `$done(...)` once with the final body or with `{}` to leave it untouched.

That means this is not possible:

```text
translate first 20 lines -> send them to YouTube App
translate next 20 lines -> append later
...
```

The closest practical equivalent is progressive caching across repeated timedtext requests.

## Relationship To DualSubs

DualSubs inspired parts of the investigation, especially:

- caching language state;
- handling `tlang`;
- using a mode/type concept;
- modifying YouTube caption metadata in other endpoints.

But this project solves a narrower problem:

```text
Only /api/timedtext XML response translation for Surge/iOS.
```

DualSubs primarily works at the captions tracklist/player-response layer. This repository works directly on the timedtext XML body after obtaining a clean upstream response.

## Known Limits

- Translation quality depends on Google Translate's unofficial endpoint.
- If Google Translate rate-limits or fails, untranslated lines are left as original text.
- If YouTube changes timedtext XML format, the XML parser logic may need updates.
- If another module rewrites `/api/timedtext` before this request script sees `tlang`, target-language recovery will fail.
- MITM must be enabled for `www.youtube.com`.

## Current Status

Verified:

- local script syntax checks pass;
- Surge `--check` accepts the Script + MITM configuration shape;
- request script produces a clean `302 Location` without `tlang`;
- response script can recover cached target language and write translated timedtext XML;
- live user testing confirmed subtitles load successfully.
