# Quantumult X

This port targets the native YouTube app on iPhone and iPad with Quantumult X.

## Files

- `yt_autotrans_quanx.js`: one-file Quantumult X script for request and response phases.
- `yt-autotrans.quanx.conf`: full Quantumult X profile example.

## Recommended rewrite

```ini
[rewrite_local]
^https://www\.youtube\.com/api/timedtext\?.*tlang= url script-request-header yt_autotrans_quanx.js
^https://www\.youtube\.com/api/timedtext\? url script-response-body yt_autotrans_quanx.js

[mitm]
hostname = www.youtube.com
```

`script-request-header` removes `tlang` before the request reaches YouTube and stores the target language locally. This avoids the YouTube timedtext `429` path without depending on client-side `302` handling.

The response script then translates the clean subtitle response locally and writes bilingual subtitles back to the YouTube app. It supports both XML timedtext and JSON3 `events/segs` subtitle payloads.

## Install

1. Save `yt_autotrans_quanx.js` to `On My iPhone/Quantumult X/Scripts/` or `iCloud Drive/Quantumult X/Scripts/`.
2. Add the two rewrite rules above, or import `yt-autotrans.quanx.conf` as a full profile.
3. Enable Rewrite and MitM.
4. Install and trust the Quantumult X CA certificate.
5. Make sure `www.youtube.com` is included in MitM hostnames.
6. Restart the YouTube app and test auto-translated captions.

## Modes

The default display mode is bilingual, source above translation:

```js
const DEFAULT_OPTIONS = {
  showOnly: false,
  position: "Forward"
};
```

You can edit `yt_autotrans_quanx.js` if you want translation-only or reversed bilingual order.

## Validation

The Quantumult X port was checked with:

```bash
node --check yt_autotrans_quanx.js
```

It was also tested on macOS Quantumult X by confirming:

- the `tlang` request matched `script-request-header`;
- the clean timedtext request matched `script-response-body`;
- JSON3 subtitles can be transformed from English into bilingual English/Chinese payloads.
