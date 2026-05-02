# Overseas SIM Official Auto-Translate Flow

This document records a successful YouTube iOS auto-translated timedtext capture under an overseas SIM / direct outbound environment.

## Capture Summary

### Sample A: Under One Hour

- Date: 2026-05-02
- App: `com.google.ios.youtube/21.17.3`
- Network mode: Surge `All direct outbound mode`
- Request host: `www.youtube.com`
- Endpoint: `/api/timedtext`
- Source language: `lang=en`
- Target language: `tlang=zh-Hant`
- Format: `format=srv3`
- Caption kind: `kind=asr`
- Status: `HTTP/1.1 200 OK`
- Response headers:
  - `Content-Type: text/xml; charset=UTF-8`
  - `Content-Encoding: gzip`
  - `Transfer-Encoding: chunked`
  - `Server: video-timedtext`

### Sample B: Over One Hour / Gemini ASR

- Date: 2026-05-02
- App: `com.google.ios.youtube/21.17.3`
- Network mode: Surge `All direct outbound mode`
- Request host: `www.youtube.com`
- Endpoint: `/api/timedtext`
- Source language: `lang=en`
- Target language: `tlang=id`
- Format: `format=srv3`
- Caption kind: `kind=asr`
- Variant: `variant=gemini`
- Status: `HTTP/1.1 200 OK`
- Response headers:
  - `Content-Type: text/xml; charset=UTF-8`
  - `Content-Encoding: gzip`
  - `Transfer-Encoding: chunked`
  - `Server: video-timedtext`
- Exported XML size: about 298KB / 305,566 bytes decoded
- Paragraph count: 3,030 `<p>` nodes
- ASR spacer count: 1,515 `<p ... a="1">` nodes
- Word/token node count: 9,020 `<s>` nodes
- Last cue starts at `t="3787560"` with `d="3520"`, ending at about 3,791,080ms, or 63m11s

## Request Shape

```text
GET /api/timedtext?...&kind=asr&lang=en&tlang=zh-Hant&format=srv3 HTTP/1.1
Host: www.youtube.com
Cache-Control: no-cache
Accept: */*
User-Agent: com.google.ios.youtube/21.17.3 (iPhone18,3; U; CPU iOS 26_4_2 like Mac OS X; zh-Hans_US)
Accept-Language: zh-CN,zh-Hans;q=0.9
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
```

## Response Shape

YouTube returns normal srv3 timedtext XML, but the subtitle body is already translated into the target language. It is not bilingual.

```xml
<?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
<head>
<ws id="0"/>
<ws id="1" mh="2" ju="0" sd="3"/>
<wp id="0"/>
<wp id="1" ap="6" ah="20" av="100" rc="2" cc="40"/>
</head>
<body>
<w t="0" id="1" wp="1" ws="1"/>
<p t="1810" d="9349" w="1">[音樂]</p>
<p t="11840" d="3679" w="1"><s ac="0">大家</s><s t="380" ac="0">好</s><s t="760" ac="0">！</s><s t="1140" ac="0">歡迎</s><s t="1520" ac="0">回到</s></p>
</body>
</timedtext>
```

For the over-one-hour `variant=gemini` ASR sample, YouTube still uses the same timedtext endpoint and response structure:

```xml
<?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
<head>
<ws id="0"/>
<ws id="1" mh="2" ju="0" sd="3"/>
<wp id="0"/>
<wp id="1" ap="6" ah="20" av="100" rc="2" cc="40"/>
</head>
<body>
<w t="0" id="1" wp="1" ws="1"/>
<p t="0" d="5520" w="1"><s>Kita </s><s t="512">akan </s><s t="1024">membahas </s><s t="1536">secara </s><s t="2048">mendalam </s><s t="2560">tentang</s></p>
<p t="2680" d="5640" w="1"><s>aksen </s><s t="440">Amerika.  </s><s t="880">Dan </s><s t="1320">ketika </s><s t="1760">saya </s><s t="2200">bilang </s><s t="2640">dalam,</s></p>
</body>
</timedtext>
```

## Observations

- Official YouTube auto-translation succeeds by sending `tlang` directly to `/api/timedtext`.
- The response body contains only the target language, even though the URL still carries `lang=en`.
- The response can be both `Content-Encoding: gzip` and `Transfer-Encoding: chunked`.
- YouTube preserves srv3 structure, `<p>` timings, and nested `<s>` nodes, but the `<s>` contents are translated tokens.
- No extra marker parameter is required. The trigger is the presence of `tlang` on the original request.
- Over-one-hour `variant=gemini` ASR tracks do not use a different auto-translate endpoint in the successful official path.
- Long-video official translation still returns the full translated timedtext XML through a single `/api/timedtext?...&tlang=...` response.
- In the over-one-hour capture, the exported response includes cues through the end of the video. `Transfer-Encoding: chunked` is HTTP transport framing, not an application-level subtitle pagination protocol.

## Design Implications

- `tlang` is the authoritative signal that the user requested auto-translation.
- A clean request without `tlang` should be treated as a normal source-language caption request unless it is the immediate redirected follow-up of a captured `tlang` request.
- Broad track-level fallback such as `v + lang + kind + variant + format` is risky because it cannot distinguish an English CC request from the clean follow-up of a translated request.
- Translation cache can be long-lived, but target-language intent metadata should be narrow and short-lived.
- Future beta work should compare this official flow with the local 302 flow and redesign metadata so selecting English CC cannot accidentally reuse a previous `tlang=zh-Hant` intent.
- The long-video issue in proxy environments is therefore not caused by YouTube requiring another API shape. It is more likely caused by the local workaround path: removing `tlang`, translating locally under a foreground response budget, and using broad metadata fallback/caching.
