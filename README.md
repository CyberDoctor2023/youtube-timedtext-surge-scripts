# YT AutoTrans Error

![Surge](https://img.shields.io/badge/Surge-iOS%20%2F%20Mac-18A0FB)
![YouTube](https://img.shields.io/badge/YouTube-TimedText-FF0000)
![Module](https://img.shields.io/badge/Module-sgmodule-34C759)
![Status](https://img.shields.io/badge/Status-Verified-brightgreen)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

**语言选择**：[中文（默认）](#中文) | [English](#english)

![模块图标](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/icon.svg)

## 中文

**YT AutoTrans Error** 是一个面向 iPhone / iPad 用户的 Surge 模块，用于修复原生 YouTube App 自动翻译字幕长期反复出现的失败问题：当 YouTube App 请求 `/api/timedtext?...&tlang=...` 时，接口可能返回 HTTP 429，或者 App 显示“加载字幕时错误”。

本仓库解决的是一个被全球用户反复报告、长期未彻底消失的问题。它在 YouTube Help Community、Reddit、ReVanced Extended、NodeSeek 等社区都有讨论；有时看似被 Google/YouTube 修复，有时只在部分平台恢复，但实际仍会复现。尤其在中国大陆相关代理/机场环境、出口 IP 不够干净时更容易触发。

这个结论来自手机端 Surge 抓包：在 iPhone 上抓取原生 YouTube App 的自动翻译字幕请求，可以看到失败链路里 `/api/timedtext?...&tlang=...` 最终返回的是 `HTTP 429`。也就是说，App 显示的“加载字幕时错误”背后不是普通 XML 替换失败，而是 YouTube timedtext 自动翻译请求在特定网络环境下被 429 拒绝。

### 错误案例

在 iPhone 原生 YouTube App 中，用户看到的通常只是一个简短的字幕错误提示：

![YouTube App 加载字幕时出错](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/youtube-subtitle-error.jpg)

通过 Surge 抓包可以进一步确认：这个 UI 错误对应的是自动翻译字幕接口 `/api/timedtext?...&tlang=...` 的 `HTTP 429`。

![Surge 抓包显示 YouTube timedtext 返回 429](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/surge-429-response.jpg)

桌面浏览器不是本项目的主要目标。电脑用户通常可以直接使用沉浸式翻译等扩展解决字幕翻译需求。本项目主要解决苹果移动生态里 iPhone / iPad 原生 YouTube App 无法通过浏览器扩展介入的问题。

### 安装

Surge 模块地址：

```text
https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/yt-autotrans.sgmodule
```

模块内容：

```ini
#!name=🗝️ YT AutoTrans Error
#!desc=Fix YouTube timedtext auto-translation 429 on Surge.
#!system=ios
#!icon=https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/icon.svg

[Script]
youtube-timedtext-request = type=http-request,pattern=^https:\/\/www\.youtube\.com\/api\/timedtext\?.*tlang=,timeout=5,script-path=https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/yt_autotrans_request.js
youtube-timedtext-response = type=http-response,pattern=^https:\/\/www\.youtube\.com\/api\/timedtext\?,requires-body=true,max-size=2097152,timeout=60,script-path=https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/yt_autotrans_response.js

[MITM]
hostname = %APPEND% www.youtube.com
```

注意：

- Surge 的模块/脚本列表里名称可能不够醒目，因此模块头部包含 `#!icon`。图标使用红色禁止符号和 `429`，用于直接表达“修复 YouTube 自动翻译字幕 429 错误”。
- 删除旧的、用于删除 `/api/timedtext` 里 `tlang` 的 URL Rewrite。
- 保留 `www.youtube.com` 的 MITM。
- 不要把 `translate.googleapis.com` 加进 MITM。它是脚本内部 `$httpClient` 主动请求的翻译接口，不是 YouTube App 发出的被拦截流量，不需要解密。

### 工作原理

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

### 为什么能绕过 429

YouTube 的自动翻译字幕请求通常带有 `tlang`：

```text
https://www.youtube.com/api/timedtext?...&lang=en&tlang=zh-Hans&format=srv3
```

在受影响环境里，只要最终打到 YouTube timedtext 后端的请求带 `tlang`，就可能返回：

```text
HTTP/1.1 429 Too Many Requests
```

YT AutoTrans Error 的关键是：**不让带 `tlang` 的请求真正发给 YouTube**。

- 原始带 `tlang` 的请求先被 Surge 拦住。
- Surge 把源语言和目标语言写入 `$persistentStore`。
- Surge 本地返回 302，让 App 重新请求不带 `tlang` 的 clean URL。
- YouTube 只看到 clean URL，因此避开 429。
- response 脚本再按之前保存的目标语言，本地翻译 XML。

### 为什么不用纯 Rewrite

纯 `[URL Rewrite]` 可以删除 `tlang`：

```ini
^https:\/\/www\.youtube\.com\/api\/timedtext\?(.*)&tlang=[^&]+&(.*) https://www.youtube.com/api/timedtext?$1&$2 302
```

它可以避开 429，但会丢失目标语言：

```text
request 1: /api/timedtext?...&lang=en&tlang=ja
rewrite:   302 to /api/timedtext?...&lang=en
request 2: /api/timedtext?...&lang=en
response:  no way to know target was ja
```

302 之后 response 脚本只能看到不带 `tlang` 的 clean URL，无法知道用户原本选择的是日文、中文、西语还是其他语言。因此纯 Rewrite 只适合硬编码翻译或“全部翻译成某一种语言”，不适合面向全球用户。

### 为什么不用 request 直接改 URL

曾经尝试过：

```javascript
$done({ url: cleanUrl });
```

这种方式是让 Surge 修改当前请求 URL 后继续发给上游。实际测试中，它对 YouTube timedtext 不够稳定：日志可能显示 request script 命中，但最终请求仍然失败，或者状态无法稳定传到 response 阶段。

当前方案是：

```javascript
$done({
  response: {
    status: 302,
    headers: { Location: cleanUrl },
    body: ""
  }
});
```

它不会把原始请求发给 YouTube，而是本地直接返回 302。这个方案更像“可编程 Rewrite”，但能在跳转前保存 `lang/tlang`。

### 全球语言支持

目标语言由 YouTube App 原始请求里的 `tlang` 决定，不在脚本里写死：

```text
lang=en&tlang=ja       English -> Japanese
lang=ko&tlang=en       Korean -> English
lang=es&tlang=zh-CN    Spanish -> Chinese
lang=fr&tlang=de       French -> German
```

这意味着它不是“只给中文用户”的脚本，而是由客户端选择目标语言，适合面向全球市场。

### 字幕 XML 处理

YouTube iOS 经常返回 srv3 XML：

```xml
<p t="160" d="4560" w="1">
  <s ac="0">Welcome</s><s t="320" ac="0"> to</s>
</p>
```

响应脚本会：

- 保留 timedtext XML 的外层结构；
- 保留 `<p>` 的 `t`、`d`、`w`、`a` 等时间属性；
- 保留空白 spacer 段落；
- 从嵌套 `<s>` 节点里提取字幕文本；
- 把翻译结果写回为单个 `<s ac="0">...</s>`。

它不会强行保留原来的逐词 `<s t="...">` 分段，因为英文词级时间戳无法可靠映射到中文、日文、韩文等翻译结果。

### 缓存策略

YT AutoTrans Error 使用两层缓存：

```text
cleanUrl -> { sourceLang, targetLang, expiresAt }
```

短期元数据缓存用于在 302 后恢复目标语言。

```text
cleanUrl + targetLang -> translated paragraph map
```

长期翻译缓存用于长视频渐进补全。Surge `http-response` 脚本不能一边翻译一边分段回传，只能完整处理后一次性 `$done(...)`。因此实际策略是：

- 有缓存的字幕立即使用；
- 每次 response 只翻译有限数量的新段落；
- 翻译结果写入缓存；
- 同一个视频、同一个目标语言后续请求会逐步补全。

### Surge CLI 验证

本项目由 Codex 协作完成，过程中以本机 Surge CLI 为准，而不是凭空猜测配置语法：

```bash
/Applications/Surge.app/Contents/Applications/surge-cli --help
```

本机 CLI 手册里确认过的相关能力：

```text
dump profile [original / effective] - Show the original profile and the effective profile modified by modules
watch request - Keep tracing the new requests
script evaluate <script-js-path> [mock-script-type] [timeout] - Load a script from a file and evaluate
--check/-c <path> - Check whether a profile is valid.
```

开发过程中使用过：

- `surge-cli --help` 确认当前 CLI 能力；
- `surge-cli --check` 验证完整测试 profile 中的 Script + MITM 配置；
- `surge-cli dump profile effective` 查看模块生效后的 profile；
- `surge-cli watch request` 和实际日志验证请求链路；
- `node --check` 验证 JavaScript 语法；
- 本地模拟 clean URL 元数据读写。

预期日志：

```text
YouTube timedtext redirect cached: en -> ja
YouTube timedtext translated: x/y
```

预期流量：

```text
Original client request contains: &tlang=<target>
Final upstream YouTube request does not contain: tlang
Upstream timedtext response is: 200 OK
```

注意：`--check` 需要完整 Surge profile。单独检查 `.sgmodule` 可能会出现 `Rules must end with FINAL` 之类的 profile 级错误。要用 CLI 验证模块内容，应把模块 section 放进一个包含 `[General]`、`[Proxy]`、`[Rule] FINAL,DIRECT` 的最小完整 profile 中。

### FAQ

#### 这是给电脑用户用的吗？

不是主要目标。电脑浏览器用户通常可以使用沉浸式翻译等扩展。YT AutoTrans Error 主要面向 iPhone / iPad 原生 YouTube App，因为原生 App 的字幕请求链路无法用普通浏览器扩展修复。

#### 需要给 `translate.googleapis.com` 加 MITM 吗？

不需要。MITM 只需要 `www.youtube.com`。因为我们要拦截的是 YouTube App 的 timedtext 请求和响应。

`translate.googleapis.com` 是脚本内部 `$httpClient.get` 主动请求的接口，不是 App 发出的需要解密的流量，也不需要改它的 response body。

#### 可以和其他 Rewrite 模块共存吗？

可以，但不能保留提前删除 `/api/timedtext` 里 `tlang` 的规则。否则 YT AutoTrans Error 看不到目标语言。

### 与 DualSubs 的关系

本项目部分参考并学习了已经失效的 DualSubs 思路，也参考了 NodeSeek 关于 YouTube “加载字幕时错误”的社区排查。

DualSubs 启发了这些方向：

- 语言状态缓存；
- `tlang` 处理；
- subtitle mode/type 的设计思路；
- YouTube caption metadata 的排查方式。

但 YT AutoTrans Error 解决的是一个更窄的 Surge/iOS 问题：

```text
只处理 /api/timedtext XML response translation。
```

DualSubs 主要处理字幕轨道列表和 player response；YT AutoTrans Error 直接在拿到干净的 timedtext XML 后做本地翻译。

### 致谢

- [@DualSubs](https://github.com/orgs/DualSubs/repositories)：感谢其早期对 YouTube captions、`tlang`、字幕模式、语言状态缓存的探索。本项目部分参考了 DualSubs 的设计思路，但实现目标和处理链路更窄。
- NodeSeek 社区与 TraderYao：感谢对 YouTube “加载字幕时错误”的排查记录，以及“干净 VPS 出口或海外 SIM 流量可规避中国环境失败”的观察。
- Reddit、YouTube Help Community、ReVanced Extended 社区：这些报告说明这不是单个用户配置错误，而是长期反复出现的自动翻译字幕可靠性问题。
- Codex：协助实现脚本、使用 Surge CLI 验证配置、整理 README，并结合真实流量日志迭代调试。

### 参考

- YouTube Help Community: [Auto-translated subtitles issue thread](https://support.google.com/youtube/thread/368737344?sjid=5480931985540789392-NC)
- Reddit: [Auto translated subtitles no longer work?](https://www.reddit.com/r/youtube/comments/1meu9kx/auto_translated_subtitles_no_longer_work/)
- Reddit: [Anyone else having trouble with auto translated subtitles?](https://www.reddit.com/r/youtube/comments/1n0kvr6/anyone_else_having_trouble_with_auto_translated/)
- Reddit: [Subtitle auto translate not showing](https://www.reddit.com/r/youtube/comments/1n2b8g1/subtitle_auto_translate_english_not_showing_in/)
- GitHub: [ReVanced Extended issue #3147](https://github.com/inotia00/ReVanced_Extended/issues/3147)

### 已知限制

- 翻译质量取决于 Google Translate 的非正式接口。
- 如果 Google Translate 限流或失败，未翻译段落会保留原文。
- 如果 YouTube 改变 timedtext XML 格式，解析逻辑可能需要更新。
- 如果其他模块提前 rewrite `/api/timedtext` 并删除 `tlang`，目标语言恢复会失败。
- 必须给 `www.youtube.com` 开启 MITM。

### 状态

已验证：

- 本地脚本语法检查通过；
- Surge `--check` 能接受完整测试 profile 中的 Script + MITM 配置形态；
- request 脚本会生成不带 `tlang` 的 clean `302 Location`；
- response 脚本能恢复缓存中的目标语言并写回翻译后的 timedtext XML；
- 真实用户测试确认字幕可以成功加载。

## English

**YT AutoTrans Error** is a Surge module for iPhone and iPad users who watch YouTube in the native YouTube app and hit the long-running auto-translated subtitle failure where `/api/timedtext` requests with `tlang` return HTTP 429 or the app shows "error loading subtitles".

This repository targets an issue repeatedly reported by global users across YouTube Help Community, Reddit, ReVanced Extended, NodeSeek, and other communities. The issue has appeared fixed, partially fixed, platform-specific, or network-specific at different times, but it continues to recur in real-world use. It is especially easy to reproduce in China-mainland-facing proxy environments with unclean exit IPs.

This conclusion comes from mobile Surge traffic capture: when capturing the native YouTube App on iPhone, the failing auto-translate subtitle path shows `/api/timedtext?...&tlang=...` returning `HTTP 429`. In other words, the visible "error loading subtitles" message is not caused by local XML replacement failure; it is caused by YouTube timedtext auto-translate requests being rejected in affected network environments.

### Error Case

In the native YouTube App on iPhone, the user usually sees only a short subtitle error message:

![YouTube App subtitle loading error](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/youtube-subtitle-error.jpg)

Surge traffic capture confirms that this UI error maps to `HTTP 429` from the auto-translate timedtext endpoint `/api/timedtext?...&tlang=...`.

![Surge capture showing YouTube timedtext 429 response](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/surge-429-response.jpg)

Desktop browsers are not the main target. On desktop, tools such as Immersive Translate can already solve many subtitle translation needs. This project exists for the Apple mobile ecosystem, where the native YouTube app cannot be fixed with normal browser extensions.

### Install

Surge module URL:

```text
https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/yt-autotrans.sgmodule
```

Important:

- The Surge module/script list may not show the script name prominently, so the module includes `#!icon`. The icon uses a red prohibition mark and `429` to make the purpose recognizable at a glance.
- Remove old `/api/timedtext` URL Rewrite rules that delete `tlang`.
- Keep MITM enabled for `www.youtube.com`.
- Do not add `translate.googleapis.com` to MITM. It is called by Surge's `$httpClient` inside the script; the app traffic does not need to be decrypted there.

### How It Works

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

### Why This Fixes 429

YouTube's auto-translate request usually contains `tlang`:

```text
https://www.youtube.com/api/timedtext?...&lang=en&tlang=zh-Hans&format=srv3
```

In affected environments, the final upstream request with `tlang` can return:

```text
HTTP/1.1 429 Too Many Requests
```

YT AutoTrans Error prevents that final upstream request from happening:

- The original request containing `tlang` is intercepted locally.
- Surge records the target language in `$persistentStore`.
- Surge returns a local `302` to the same URL without `tlang`.
- YouTube only receives the clean URL, so the fragile `tlang` path is avoided.
- The response script uses the saved metadata to translate the returned XML locally.

### Why Not Pure URL Rewrite

A pure `[URL Rewrite]` can remove `tlang`, but it loses the target language after the client follows the 302:

```text
request 1: /api/timedtext?...&lang=en&tlang=ja
rewrite:   302 to /api/timedtext?...&lang=en
request 2: /api/timedtext?...&lang=en
response:  no way to know target was ja
```

That means pure rewrite can only support hard-coded translation or "translate everything" behavior. It is not suitable for a global product where the YouTube client decides the target language.

### Why Not Request URL Mutation

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

### Global Target Language

The target language is chosen by the YouTube client:

```text
lang=en&tlang=ja       English -> Japanese
lang=ko&tlang=en       Korean -> English
lang=es&tlang=zh-CN    Spanish -> Chinese
lang=fr&tlang=de       French -> German
```

### TimedText XML Handling

YouTube iOS often returns srv3 XML:

```xml
<p t="160" d="4560" w="1">
  <s ac="0">Welcome</s><s t="320" ac="0"> to</s>
</p>
```

The response script preserves the timedtext XML shell and paragraph timing attributes, extracts visible text from nested `<s>` nodes, and writes translated text back as a single `<s ac="0">...</s>` node.

### Cache Strategy

YT AutoTrans Error uses two cache layers:

```text
cleanUrl -> { sourceLang, targetLang, expiresAt }
cleanUrl + targetLang -> translated paragraph map
```

Surge `http-response` scripts cannot stream partial subtitle responses; they receive the complete body and call `$done(...)` once. Therefore the practical strategy is progressive caching: use existing cached lines immediately, translate a bounded amount per response, and store translated paragraphs for later requests.

### Surge CLI Verification

This project was designed and verified with help from Codex using the local Surge CLI:

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

Development checks included `surge-cli --help`, `surge-cli --check` against a complete test profile, `dump profile effective`, `watch request`, `node --check`, and local simulation of clean URL metadata lookup.

### FAQ

#### Is this for desktop users?

Not primarily. Desktop browser users can often use Immersive Translate or similar extensions. YT AutoTrans Error focuses on the native YouTube iOS app, where browser extensions cannot intercept and repair the subtitle request pipeline.

#### Do I need MITM for `translate.googleapis.com`?

No. MITM is only needed for `www.youtube.com`, because Surge must inspect and modify the YouTube App's timedtext request and response. `translate.googleapis.com` is requested by Surge's script through `$httpClient.get`.

#### Can this coexist with other rewrite modules?

Yes, but do not keep any rule that rewrites `/api/timedtext?...tlang=...` before YT AutoTrans Error sees it. If another module deletes `tlang` first, YT AutoTrans Error cannot know the requested target language.

### Relationship To DualSubs

This project partially references and learns from the now-broken DualSubs approach and NodeSeek community troubleshooting around YouTube "加载字幕时错误".

DualSubs inspired language-state caching, `tlang` handling, subtitle mode/type thinking, and YouTube caption metadata investigation. But YT AutoTrans Error solves a narrower Surge/iOS problem: only `/api/timedtext` XML response translation after obtaining a clean upstream response.

### Acknowledgements

- [@DualSubs](https://github.com/orgs/DualSubs/repositories), for earlier exploration of YouTube captions, `tlang`, subtitle modes, and language-state caching.
- NodeSeek community discussion by TraderYao, for documenting the YouTube "加载字幕时错误" troubleshooting path and the observation that clean VPS exits or overseas SIM traffic can avoid the China-environment failure.
- Reddit, YouTube Help Community, and ReVanced Extended reports, for showing this is a broader long-running auto-translate subtitle reliability issue rather than a single-user misconfiguration.
- Codex, for implementation assistance, Surge CLI based verification, README drafting, and iterative debugging with live traffic logs.

### References

- YouTube Help Community: [Auto-translated subtitles issue thread](https://support.google.com/youtube/thread/368737344?sjid=5480931985540789392-NC)
- Reddit: [Auto translated subtitles no longer work?](https://www.reddit.com/r/youtube/comments/1meu9kx/auto_translated_subtitles_no_longer_work/)
- Reddit: [Anyone else having trouble with auto translated subtitles?](https://www.reddit.com/r/youtube/comments/1n0kvr6/anyone_else_having_trouble_with_auto_translated/)
- Reddit: [Subtitle auto translate not showing](https://www.reddit.com/r/youtube/comments/1n2b8g1/subtitle_auto_translate_english_not_showing_in/)
- GitHub: [ReVanced Extended issue #3147](https://github.com/inotia00/ReVanced_Extended/issues/3147)

### Known Limits

- Translation quality depends on Google Translate's unofficial endpoint.
- If Google Translate rate-limits or fails, untranslated lines are left as original text.
- If YouTube changes timedtext XML format, parser logic may need updates.
- If another module rewrites `/api/timedtext` before this request script sees `tlang`, target-language recovery will fail.
- MITM must be enabled for `www.youtube.com`.

### Status

Verified:

- local script syntax checks pass;
- Surge `--check` accepts the Script + MITM configuration shape inside a complete test profile;
- request script produces a clean `302 Location` without `tlang`;
- response script can recover cached target language and write translated timedtext XML;
- live user testing confirmed subtitles load successfully.
