# YT AutoTrans Error for Quantumult X

![Quantumult X](https://img.shields.io/badge/Quantumult%20X-iOS%20%2F%20Mac-7A5CFF)
![YouTube](https://img.shields.io/badge/YouTube-TimedText-FF0000)
![Status](https://img.shields.io/badge/Status-Tested-brightgreen)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

**Language / 语言**：[中文](quantumult-x.zh.md) | [English](quantumult-x.en.md)

## English

**YT AutoTrans Error for Quantumult X** is a Quantumult X port for the native YouTube app on iPhone and iPad. It fixes the recurring auto-translated subtitle failure where YouTube shows "error loading subtitles".

In affected network environments, the YouTube app requests auto-translated captions with URLs like:

```text
https://www.youtube.com/api/timedtext?...&lang=en&tlang=zh-Hant&format=json3
```

If the final request sent to YouTube timedtext contains `tlang`, the backend may return `HTTP 429 Too Many Requests`. The Quantumult X port avoids this by **removing `tlang` before the request reaches YouTube, storing the target language locally, then translating the clean subtitle response and returning bilingual subtitles to the app.**

### Files

```text
yt_autotrans_quanx.js
yt-autotrans.quanx.conf
```

- `yt_autotrans_quanx.js`: one-file Quantumult X script for both request and response phases.
- `yt-autotrans.quanx.conf`: full Quantumult X profile example.

### Scope

- Native YouTube app on iPhone / iPad.
- YouTube auto-translated captions show "error loading subtitles".
- Quantumult X records show `/api/timedtext?...&tlang=...`.
- Proxy exit IPs that easily trigger YouTube timedtext 429.
- Bilingual captions, source above translation by default.

### Install

1. Save `yt_autotrans_quanx.js` to:

```text
On My iPhone/Quantumult X/Scripts/yt_autotrans_quanx.js
```

or:

```text
iCloud Drive/Quantumult X/Scripts/yt_autotrans_quanx.js
```

2. Add these rules to your Quantumult X profile:

```ini
[rewrite_local]
^https://www\.youtube\.com/api/timedtext\?.*tlang= url script-request-header yt_autotrans_quanx.js
^https://www\.youtube\.com/api/timedtext\? url script-response-body yt_autotrans_quanx.js

[mitm]
hostname = www.youtube.com
```

You can also import `yt-autotrans.quanx.conf` as a full profile example.

3. Enable Rewrite.
4. Enable MitM.
5. Install and trust the Quantumult X CA certificate.
6. Make sure `www.youtube.com` is included in MitM hostnames.
7. Force quit and reopen the YouTube app, then test auto-translated captions.

### How It Works

```text
Original YouTube app request
  |
  | 1. /api/timedtext?...&lang=en&tlang=zh-Hant
  v
Quantumult X request script
  |
  | 2. Store cleanUrl -> sourceLang / targetLang
  | 3. Rewrite request URL to cleanUrl before sending it upstream
  v
YouTube timedtext backend
  |
  | 4. Return original XML or JSON3 captions
  v
Quantumult X response script
  |
  | 5. Read target language and call Google Translate locally
  | 6. Write bilingual subtitles back
  v
YouTube app displays captions
```

### Why This Port Does Not Use 302

The Surge module returns a local `302 Location: cleanUrl` in the request phase. In some Quantumult X + YouTube app setups, the local 302 flow is not stable enough: the script may show a request notification, but the YouTube app can still report a subtitle loading error.

The Quantumult X port uses:

```ini
script-request-header
```

and calls:

```js
$done({ url: cleanUrl });
```

This makes the YouTube app behave as if it had sent a normal clean timedtext request from the beginning, without depending on local redirect handling.

### Subtitle Formats

The Quantumult X port supports two YouTube timedtext payload formats:

- XML / srv3: `<p>` and `<s>` nodes.
- JSON3: `events` / `segs` subtitle structure.

JSON3 captions are rewritten into:

```json
{
  "utf8": "Hello world\n你好世界"
}
```

XML captions are rewritten into:

```xml
<s ac="0">Hello world&#x000A;你好世界</s>
```

### Notifications

The script posts Quantumult X notifications to make field debugging easier:

```text
YT AutoTrans
request rewrite OK
en -> zh-Hant
```

The request phase removed `tlang` successfully.

```text
YT AutoTrans
json3 OK
2/2 translated
```

JSON3 captions were rewritten as bilingual captions.

```text
YT AutoTrans
response OK
2/2 translated
```

XML captions were rewritten as bilingual captions.

### Modes

The default mode is bilingual:

```js
const DEFAULT_OPTIONS = {
  showOnly: false,
  position: "Forward"
};
```

Output:

```text
source
translation
```

To show translation only, edit:

```js
showOnly: true
```

To put translation above source, edit:

```js
position: "Reverse"
```

### Cache

The script uses two local caches:

```text
cleanUrl -> { sourceLang, targetLang, expiresAt }
cleanUrl + targetLang -> translated subtitle map
```

This lets the same video and target language reuse translated subtitle items across repeated requests.

### Validation

This port was checked with:

```bash
node --check yt_autotrans_quanx.js
```

It was also tested on macOS Quantumult X by confirming:

- `tlang` timedtext requests matched `script-request-header`;
- clean timedtext responses matched `script-response-body`;
- JSON3 English captions can be converted into bilingual English/Chinese payloads;
- the unofficial Google Translate endpoint can return Chinese translations.

### Known Limitations

- Translation quality depends on the unofficial Google Translate endpoint.
- If Google Translate rate limits or fails, some captions may temporarily remain in the source language.
- If another rule removes `tlang` first, the script cannot recover the target language.
- `www.youtube.com` must be enabled in MitM.
- If YouTube changes timedtext XML or JSON3 structures, the parser may need updates.

### Troubleshooting

If captions still show only English:

- Make sure the notification says `request rewrite OK`, not the older `request OK`.
- Make sure the phone copy of `yt_autotrans_quanx.js` has been replaced with the latest version.
- Check whether the response phase posts `json3 OK` or `response OK`.
- Make sure `translate.googleapis.com` is reachable.
- Remove other YouTube caption rewrite rules and test again.

If YouTube still shows "error loading subtitles":

- Make sure the MitM certificate is installed and trusted.
- Make sure `www.youtube.com` is included in MitM hostnames.
- Make sure the Rewrite master switch is enabled.
- Make sure the script is saved under `Quantumult X/Scripts/` and named exactly `yt_autotrans_quanx.js`.
