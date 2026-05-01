# YT AutoTrans Error

![Surge](https://img.shields.io/badge/Surge-iOS%20%2F%20Mac-18A0FB)
![YouTube](https://img.shields.io/badge/YouTube-TimedText-FF0000)
![Module](https://img.shields.io/badge/Module-sgmodule-34C759)
![Status](https://img.shields.io/badge/Status-Verified-brightgreen)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

**YT AutoTrans Error** is a Surge module for iPhone / iPad users who watch YouTube in the native YouTube app and hit the long-running auto-translated subtitle failure where `/api/timedtext` requests with `tlang` return HTTP 429 or the app shows "error loading subtitles".

**YT AutoTrans Error** 是一个面向 iPhone / iPad 用户的 Surge 模块，主要修复原生 YouTube App 自动翻译字幕长期反复出现的失败问题：当 YouTube App 请求 `/api/timedtext?...&tlang=...` 时，接口可能返回 HTTP 429，或者 App 显示“加载字幕时错误”。

This repository targets an issue repeatedly reported by global users across YouTube Help Community, Reddit, ReVanced Extended, NodeSeek, and other communities. The issue has appeared fixed, partially fixed, platform-specific, or network-specific at different times, but it continues to recur in real-world use. It is especially easy to reproduce in China-mainland-facing proxy/airport environments with unclean exit IPs.

本仓库解决的是一个被全球用户反复报告、长期未彻底消失的问题。它在 YouTube Help Community、Reddit、ReVanced Extended、NodeSeek 等社区都有讨论；有时看似被 Google/YouTube 修复，有时只在部分平台恢复，但实际仍会复现。尤其在中国大陆相关代理/机场环境、出口 IP 不够干净时更容易触发。

Desktop browsers are not the main target. On desktop, tools such as Immersive Translate can already solve many subtitle translation needs. This project exists for the Apple mobile ecosystem, where the native YouTube app cannot be fixed with normal browser extensions.

桌面浏览器不是本项目的主要目标。电脑用户通常可以直接使用沉浸式翻译等扩展解决字幕翻译需求。本项目主要解决苹果移动生态里 iPhone / iPad 原生 YouTube App 无法通过浏览器扩展介入的问题。

## Install / 安装

Surge module URL:

```text
https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/yt-autotrans.sgmodule
```

Module content:

```ini
#!name=YT AutoTrans Error
#!desc=Fix YouTube timedtext auto-translation 429 on Surge.
#!system=ios

[Script]
youtube-timedtext-request = type=http-request,pattern=^https:\/\/www\.youtube\.com\/api\/timedtext\?.*tlang=,timeout=5,script-path=https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/youtube_timedtext_request.js
youtube-timedtext-response = type=http-response,pattern=^https:\/\/www\.youtube\.com\/api\/timedtext\?,requires-body=true,max-size=2097152,timeout=60,script-path=https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/youtube_timedtext_response.js

[MITM]
hostname = %APPEND% www.youtube.com
```

Important:

- Remove old `/api/timedtext` URL Rewrite rules that delete `tlang`.
- Keep MITM enabled for `www.youtube.com`.
- Do **not** add `translate.googleapis.com` to MITM. It is called by Surge's `$httpClient` inside the script; the app traffic does not need to be decrypted there.

注意：

- 删除旧的、用于删除 `/api/timedtext` 里 `tlang` 的 URL Rewrite。
- 保留 `www.youtube.com` 的 MITM。
- **不要**把 `translate.googleapis.com` 加进 MITM。它是脚本内部 `$httpClient` 主动请求的翻译接口，不是 YouTube App 发出的被拦截流量，不需要解密。

## How It Works / 工作原理

```text
YouTube App
  |
  | 1. /api/timedtext?...&lang=en&tlang=ja
  v
Surge http-request script
  |
  | 2. Save metadata: cleanUrl -> en -> ja
  | 3. Return local 302 Location: cleanUrl
  v
YouTube App follows redirect
  |
  | 4. /api/timedtext?...&lang=en
  v
YouTube server
  |
  | 5. 200 OK original timedtext XML
  v
Surge http-response script
  |
  | 6. Read metadata, translate XML locally
  v
YouTube App displays translated subtitles
```

```text
YouTube App 原始请求
  |
  | 1. /api/timedtext?...&lang=en&tlang=ja
  v
Surge 请求脚本
  |
  | 2. 保存 cleanUrl -> en -> ja
  | 3. 本地返回 302 Location: cleanUrl
  v
YouTube App 跟随重定向
  |
  | 4. /api/timedtext?...&lang=en
  v
YouTube 服务端
  |
  | 5. 返回 200 OK 原始字幕 XML
  v
Surge 响应脚本
  |
  | 6. 读取目标语言，本地翻译 XML
  v
YouTube App 显示翻译字幕
```

## Why This Fixes 429 / 为什么能绕过 429

YouTube's auto-translate request usually contains `tlang`:

```text
https://www.youtube.com/api/timedtext?...&lang=en&tlang=zh-Hans&format=srv3
```

In affected environments, the final upstream request with `tlang` can return:

```text
HTTP/1.1 429 Too Many Requests
```

YT AutoTrans prevents that final upstream request from happening:

- The original request containing `tlang` is intercepted locally.
- Surge records the target language in `$persistentStore`.
- Surge returns a local `302` to the same URL without `tlang`.
- YouTube only receives the clean URL, so the fragile `tlang` path is avoided.
- The response script uses the saved metadata to translate the returned XML locally.

YouTube 的自动翻译字幕请求通常带有 `tlang`。在受影响环境里，只要最终打到 YouTube timedtext 后端的请求带 `tlang`，就可能 429。

YT AutoTrans 的关键是：**不让带 `tlang` 的请求真正发给 YouTube**。

- 原始带 `tlang` 的请求先被 Surge 拦住。
- Surge 把源语言和目标语言写入 `$persistentStore`。
- Surge 本地返回 302，让 App 重新请求不带 `tlang` 的 clean URL。
- YouTube 只看到 clean URL，因此避开 429。
- response 脚本再按之前保存的目标语言，本地翻译 XML。

## Why Not Pure URL Rewrite / 为什么不用纯 Rewrite

A pure `[URL Rewrite]` can remove `tlang`:

```ini
^https:\/\/www\.youtube\.com\/api\/timedtext\?(.*)&tlang=[^&]+&(.*) https://www.youtube.com/api/timedtext?$1&$2 302
```

It avoids 429, but loses the target language:

```text
request 1: /api/timedtext?...&lang=en&tlang=ja
rewrite:   302 to /api/timedtext?...&lang=en
request 2: /api/timedtext?...&lang=en
response:  no way to know target was ja
```

That means pure rewrite can only support hard-coded translation or "translate everything" behavior. It is not suitable for a global product where the YouTube client decides the target language.

纯 Rewrite 可以避开 429，但会丢失 `tlang`。302 之后 response 脚本只能看到不带 `tlang` 的 clean URL，无法知道用户原本选择的是日文、中文、西语还是其他语言。因此它不适合面向全球用户。

## Why Not Request URL Mutation / 为什么不用 request 直接改 URL

Rejected approach:

```javascript
$done({ url: cleanUrl });
```

This asks Surge to modify the current request and continue sending it upstream. In testing, this path was not reliable enough for YouTube timedtext: the script could appear to match, while the final request still failed or state did not reliably reach the response phase.

Current approach:

```javascript
$done({
  response: {
    status: 302,
    headers: { Location: cleanUrl },
    body: ""
  }
});
```

This does not send the original request upstream. It behaves like a programmable local 302 rewrite, with one extra ability: it saves `lang/tlang` before redirecting.

之前失败的是直接修改当前请求 URL 后继续发给 YouTube。现在的方案不是这样。现在 request 脚本直接返回本地 302，不把原始请求发出去；它更像“可编程 Rewrite”，但能在跳转前保存目标语言。

## Global Target Language / 全球语言支持

The target language is chosen by the YouTube client:

```text
lang=en&tlang=ja       English -> Japanese
lang=ko&tlang=en       Korean -> English
lang=es&tlang=zh-CN    Spanish -> Chinese
lang=fr&tlang=de       French -> German
```

目标语言由 YouTube App 原始请求里的 `tlang` 决定，不在脚本里写死。因此可以服务全球用户。

## TimedText XML Handling / 字幕 XML 处理

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
- extracts text from nested `<s>` nodes;
- writes translated text back as a single `<s ac="0">...</s>`.

响应脚本会保留 timedtext XML 骨架和 `<p>` 的时间属性，只替换可显示字幕文本。它不会强行保留原来的逐词 `<s t="...">` 分段，因为英文词级时间戳无法可靠映射到中文、日文、韩文等翻译结果。

## Cache Strategy / 缓存策略

YT AutoTrans uses two cache layers:

1. Redirect metadata cache

```text
cleanUrl -> { sourceLang, targetLang, expiresAt }
```

This short-lived cache lets the response script recover `tlang` after the client follows the 302.

2. Translation cache

```text
cleanUrl + targetLang -> translated paragraph map
```

This longer-lived cache helps long videos. Surge `http-response` scripts cannot stream partial subtitle responses; they receive the complete body and call `$done(...)` once. Therefore the practical strategy is progressive caching:

- use cached translations immediately;
- translate a bounded amount per response;
- store translated paragraphs;
- subsequent requests for the same video and target language become more complete.

YT AutoTrans 使用两层缓存：短期元数据缓存用于在 302 后恢复目标语言，长期翻译缓存用于长视频渐进补全。Surge response 脚本不能一边翻译一边分段回传，只能完整处理后一次性 `$done(...)`。

## Surge CLI Verification / Surge CLI 验证

This project was designed and verified with help from Codex using the local Surge CLI. We used the local manual instead of guessing:

```bash
/Applications/Surge.app/Contents/Applications/surge-cli --help
```

Relevant local CLI entries:

```text
dump profile [original / effective] - Show the original profile and the effective profile modified by modules
watch request - Keep tracing the new requests
script evaluate <script-js-path> [mock-script-type] [timeout] - Load a script from a file and evaluate
--check/-c <path> - Check whether a profile is valid.
```

Development checks:

- `surge-cli --help` to confirm current CLI behavior.
- `surge-cli --check` against a complete test profile containing the module sections.
- `surge-cli dump profile effective` to inspect module-applied profile output.
- `surge-cli watch request` and live logs to confirm the request chain.
- `node --check` for JavaScript syntax.
- Local simulation to verify clean URL metadata lookup.

本项目由 Codex 协作完成，过程中以本机 Surge CLI 为准：用 `--help` 查看当前手册，用 `--check` 验证配置形态，用 `dump profile effective` 查看模块生效后的 profile，用 `watch request` 和实际日志验证链路。

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

Note: `--check` expects a complete Surge profile. A standalone `.sgmodule` may fail with profile-level errors such as `Rules must end with FINAL`. To validate module contents with CLI, place the module sections inside a minimal complete profile containing `[General]`, `[Proxy]`, and `[Rule] FINAL,DIRECT`.

## FAQ

### Is this for desktop users?

Not primarily. Desktop browser users can often use Immersive Translate or similar extensions. YT AutoTrans Error focuses on the native YouTube iOS app, where browser extensions cannot intercept and repair the subtitle request pipeline.

### 这是给电脑用户用的吗？

不是主要目标。电脑浏览器用户通常可以使用沉浸式翻译等扩展。YT AutoTrans Error 主要面向 iPhone / iPad 原生 YouTube App，因为原生 App 的字幕请求链路无法用普通浏览器扩展修复。

### Do I need MITM for `translate.googleapis.com`?

No. MITM is only needed for `www.youtube.com`, because Surge must inspect and modify the YouTube App's timedtext request and response.

`translate.googleapis.com` is requested by Surge's script through `$httpClient.get`. We do not need to decrypt app traffic for that host, and we do not rewrite its response body.

### 需要给 `translate.googleapis.com` 加 MITM 吗？

不需要。MITM 只需要 `www.youtube.com`。因为我们要拦截的是 YouTube App 的 timedtext 请求和响应。

`translate.googleapis.com` 是脚本内部 `$httpClient.get` 主动请求的接口，不是 App 发出的需要解密的流量，也不需要改它的 response body。

### Can this coexist with other rewrite modules?

Yes, but do not keep any rule that rewrites `/api/timedtext?...tlang=...` before YT AutoTrans sees it. If another module deletes `tlang` first, YT AutoTrans cannot know the requested target language.

### 可以和其他 Rewrite 模块共存吗？

可以，但不能保留提前删除 `/api/timedtext` 里 `tlang` 的规则。否则 YT AutoTrans 看不到目标语言。

## Relationship To DualSubs / 与 DualSubs 的关系

This project partially references and learns from the now-broken DualSubs approach and NodeSeek community troubleshooting around YouTube "加载字幕时错误".

DualSubs inspired:

- language-state caching;
- `tlang` handling;
- mode/type thinking;
- YouTube caption metadata investigation.

But YT AutoTrans solves a narrower Surge/iOS problem:

```text
Only /api/timedtext XML response translation.
```

DualSubs primarily worked around caption tracklist/player-response behavior. YT AutoTrans works directly on timedtext XML after obtaining a clean upstream response.

本项目参考了已经失效的 DualSubs 思路，也参考了 NodeSeek 关于 YouTube “加载字幕时错误”的社区排查。DualSubs 主要处理字幕轨道列表和 player response；YT AutoTrans 更窄，只处理 Surge/iOS 场景下 `/api/timedtext` XML 的本地翻译。

## Acknowledgements / 致谢

- DualSubs, for earlier exploration of YouTube captions, `tlang`, subtitle modes, and language-state caching.
- NodeSeek community discussion by TraderYao, for documenting the YouTube "加载字幕时错误" troubleshooting path and the observation that clean VPS exits or overseas SIM traffic can avoid the China-environment failure.
- Reddit, YouTube Help Community, and ReVanced Extended reports, for showing this is a broader long-running auto-translate subtitle reliability issue rather than a single-user misconfiguration.
- Codex, for implementation assistance, Surge CLI based verification, README drafting, and iterative debugging with live traffic logs.

## References / 参考

- YouTube Help Community: [Auto-translated subtitles issue thread](https://support.google.com/youtube/thread/368737344?sjid=5480931985540789392-NC)
- Reddit: [Auto translated subtitles no longer work?](https://www.reddit.com/r/youtube/comments/1meu9kx/auto_translated_subtitles_no_longer_work/)
- Reddit: [Anyone else having trouble with auto translated subtitles?](https://www.reddit.com/r/youtube/comments/1n0kvr6/anyone_else_having_trouble_with_auto_translated/)
- Reddit: [Subtitle auto translate not showing](https://www.reddit.com/r/youtube/comments/1n2b8g1/subtitle_auto_translate_english_not_showing_in/)
- GitHub: [ReVanced Extended issue #3147](https://github.com/inotia00/ReVanced_Extended/issues/3147)

## Known Limits / 已知限制

- Translation quality depends on Google Translate's unofficial endpoint.
- If Google Translate rate-limits or fails, untranslated lines are left as original text.
- If YouTube changes timedtext XML format, parser logic may need updates.
- If another module rewrites `/api/timedtext` before this request script sees `tlang`, target-language recovery will fail.
- MITM must be enabled for `www.youtube.com`.

## Status / 状态

Verified:

- local script syntax checks pass;
- Surge `--check` accepts the Script + MITM configuration shape inside a complete test profile;
- request script produces a clean `302 Location` without `tlang`;
- response script can recover cached target language and write translated timedtext XML;
- live user testing confirmed subtitles load successfully.
