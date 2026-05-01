# YT AutoTrans Error

![Surge](https://img.shields.io/badge/Surge-iOS%20%2F%20Mac-18A0FB)
![YouTube](https://img.shields.io/badge/YouTube-TimedText-FF0000)
![Module](https://img.shields.io/badge/Module-sgmodule-34C759)
![Status](https://img.shields.io/badge/Status-Verified-brightgreen)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

**语言 / Language**：[中文](#中文) | [English](#english)

![YT AutoTrans Error icon](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/icon.svg)

## 中文

**YT AutoTrans Error** 是一个面向 iPhone / iPad 原生 YouTube App 的 Surge 模块，用来修复自动翻译字幕反复出现的“加载字幕时错误”问题。

在受影响的网络环境里，YouTube App 请求自动翻译字幕时会访问：

```text
https://www.youtube.com/api/timedtext?...&lang=en&tlang=zh-Hans&format=srv3
```

只要最终发给 YouTube timedtext 后端的请求带有 `tlang`，就可能返回 `HTTP 429 Too Many Requests`。本模块的核心做法是：**不把带 `tlang` 的请求发给 YouTube，而是在本地保存目标语言、重定向到干净字幕 URL，再把返回的原始字幕 XML 本地翻译后交给 YouTube App。**

### 适用场景

- iPhone / iPad 原生 YouTube App。
- YouTube 自动翻译字幕显示“加载字幕时错误”。
- Surge 抓包能看到 `/api/timedtext?...&tlang=...` 返回 `HTTP 429`。
- 尤其适合代理出口 IP 不够干净、容易触发 YouTube timedtext 429 的环境。

桌面浏览器不是本项目的主要目标。电脑用户通常可以使用沉浸式翻译等扩展解决字幕翻译需求。

### 错误截图

YouTube App 里看到的错误通常是：

![YouTube App 加载字幕时出错](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/youtube-subtitle-error.jpg)

Surge 抓包里对应的是 timedtext 接口返回 `429`：

![Surge 抓包显示 YouTube timedtext 返回 429](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/surge-429-response.png)

网络较慢或 Google 翻译接口响应慢时，也可能出现另一类失败：YouTube 后端已经返回 `200 OK`，但 Surge response 脚本仍在等待翻译，YouTube App 在约 8 秒左右主动断开连接。抓包里通常能看到 `Active` 接近 8 秒：

![Surge 抓包显示 timedtext active 接近 8 秒](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/surge-active-timeout.jpg)

### 安装

Surge 模块地址：

```text
https://github.com/CyberDoctor2023/yt-autotrans/releases/latest/download/yt-autotrans.sgmodule
```

安装后请确认：

- 开启 `www.youtube.com` 的 MITM。
- 删除旧的 `/api/timedtext` URL Rewrite，尤其是提前删除 `tlang` 的规则。
- 不需要给 `translate.googleapis.com` 开 MITM；它是脚本内部 `$httpClient` 请求，不是 YouTube App 流量。

### 参数

模块使用 Surge 的 `#!arguments` 参数表。默认值已经可用，不填写也会启用双语模式。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `mode` | `dual` | 字幕显示模式 |
| `version` | `v2026.05.01.8` | 只用于在 Surge 中对照 GitHub Release 版本，脚本不会读取 |

`mode` 可选值：

| 值 | 效果 |
| --- | --- |
| `dual` | 双语，原文在上、译文在下；英译中时就是英中 |
| `reverse` | 双语，译文在上、原文在下；英译中时就是中英 |
| `single` | 单语，只显示译文 |

模块标题带有 `🗝️`，并配置了 `#!icon`。这是因为 Surge 的脚本列表里有时不容易看到脚本名称，图标和标题可以更直观地标识“429 自动翻译字幕修复”。

### 工作原理

```text
YouTube App 原始请求
  |
  | 1. /api/timedtext?...&lang=en&tlang=ja
  v
Surge request 脚本
  |
  | 2. 保存 cleanUrl -> sourceLang / targetLang
  | 3. 本地返回 302 Location: cleanUrl
  v
YouTube App 跟随重定向
  |
  | 4. /api/timedtext?...&lang=en
  v
YouTube timedtext 后端
  |
  | 5. 返回 200 OK 原始字幕 XML
  v
Surge response 脚本
  |
  | 6. 读取目标语言，本地翻译 timedtext XML
  v
YouTube App 显示翻译字幕
```

### 设计说明

- **为什么不用纯 URL Rewrite？**
  Rewrite 删除 `tlang` 后，response 阶段只看得到干净 URL，已经不知道用户选择的是中文、日文、西语还是其他语言。它可以避开 429，但不适合全球用户。

- **为什么不用 request 脚本直接改 URL？**
  `$done({ url: cleanUrl })` 在实际测试里不够稳定。当前方案改为本地返回 302，不把原始带 `tlang` 的请求发给 YouTube，同时在跳转前保存语言状态。

- **目标语言怎么决定？**
  完全由 YouTube App 原始请求中的 `tlang` 决定，例如 `en -> ja`、`ko -> en`、`es -> zh-CN`。脚本不写死中文。

- **外部脚本怎么更新？**
  本机 `surge-cli --help` 能看到 `external-resource update <key>` 和 `external-resource update all`，但没有模块级“安装时强制刷新全部外部脚本”的指令。因此模块同时使用 `script-update-interval=3600`、`#!version` 和脚本 URL 的 `?v=...`，让每次发版都对应新的外部资源 URL。

- **为什么要限制翻译耗时？**
  timedtext 是 YouTube App 正在等待的字幕响应，不是后台任务。真实抓包显示，当 Active 接近 8 秒时客户端可能直接断开。因此当前版本把 Google 翻译单请求 timeout 收紧到 2 秒、每轮最多翻译 2 个 chunk，并设置 5 秒 response 预算；超过预算会尽快返回，并在字幕中写入 `[YT AutoTrans] Google 翻译服务超时，请稍后重试。`，方便判断是翻译服务慢，而不是 YouTube 429。

### 字幕处理

YouTube iOS 常见返回格式是 srv3 timedtext XML：

```xml
<p t="160" d="4560" w="1">
  <s ac="0">Welcome</s><s t="320" ac="0"> to</s>
</p>
```

response 脚本不会重造整个 XML，而是在保留 timedtext 外壳和 `<p>` 时间属性的前提下替换字幕文本。

当前处理包括：

- 保留 `<p>` 的 `t`、`d`、`w`、`a` 等时间和窗口属性。
- 从嵌套 `<s>` 节点中提取可见文本。
- 双语换行写为 XML 数字实体 `&#x000A;`，避免真实换行被 YouTube renderer 折叠。
- 人工字幕和 ASR 自动识别字幕隔离处理。
- ASR 自动字幕会删除空白 roll-up spacer，例如 `<p ... a="1"></p>`。
- ASR 自动字幕会把左侧/roll-up 窗口归一化为底部居中窗口。
- ASR 自动字幕会把窗口列宽从常见的 `cc=40` 放宽到 `cc=80`。
- 过长 ASR 段落会按词级时间戳切分；过短 cue 会补入相邻上下文，减少一两个词快速闪过。
- ASR roll-up 时间轴的重叠段会裁剪 `d`，避免双语字幕叠成三行。
- Google 翻译超时或失败且本轮没有可用翻译时，会写入明确的超时提示字幕，避免一直等待到 YouTube App 断开。

脚本不会强行保留原始逐词 `<s t="...">` 分段，因为英文词级时间戳无法可靠映射到中文、日文、韩文等翻译结果。

### 缓存

模块使用两层缓存：

```text
cleanUrl -> { sourceLang, targetLang, expiresAt }
cleanUrl + targetLang -> translated paragraph map
```

Surge `http-response` 脚本不能一边翻译一边分段回传，只能在处理完后一次性 `$done(...)`。因此本模块采用渐进缓存策略：

- 有缓存的段落立即使用。
- 每次 response 只翻译有限数量的新段落，当前版本首轮最多 2 个 chunk。
- 新翻译写入缓存。
- 同一个视频、同一个目标语言后续请求会逐步补全。

### 验证

本项目由 Codex 协作实现，并以本机 Surge CLI 行为为准进行验证：

```bash
/Applications/Surge.app/Contents/Applications/surge-cli --help
```

用到的验证包括：

- `surge-cli --help`：确认 CLI 支持的真实命令。
- `surge-cli --check`：验证完整测试 profile 中的 Script + MITM 配置。
- `surge-cli dump profile effective`：查看模块合并后的有效配置。
- `surge-cli watch request`：观察实际 timedtext 请求链路。
- `surge-cli external-resource update all`：确认外部资源更新方式。
- `node --check`：验证 request/response 脚本语法。

注意：`--check` 需要完整 Surge profile。单独检查 `.sgmodule` 可能会遇到 `Rules must end with FINAL` 这类 profile 级错误。

### 已知限制

- 翻译质量取决于 Google Translate 的非正式接口。
- 如果 Google Translate 限流、失败或超过 5 秒响应预算，脚本会尽快返回；无可用翻译时会写入超时提示字幕，方便排查。
- 如果 YouTube 改变 timedtext XML 格式，解析逻辑可能需要更新。
- 如果其他模块先删除 `/api/timedtext` 里的 `tlang`，目标语言恢复会失败。
- 必须给 `www.youtube.com` 开启 MITM。

### 致谢

- [@DualSubs](https://github.com/orgs/DualSubs/repositories) 与 [DualSubs/Universal](https://github.com/DualSubs/Universal)：感谢其早期对字幕增强、`tlang`、字幕模式、语言状态缓存、模块参数和双语输出设计的探索。本项目部分参考了这些思路，但实现目标更窄，只处理 YouTube timedtext XML response。
- NodeSeek 社区与 TraderYao：感谢对 YouTube “加载字幕时错误”的排查记录，以及“干净 VPS 出口或海外 SIM 流量可规避中国环境失败”的观察。
- Reddit、YouTube Help Community、ReVanced Extended 社区：这些报告说明这不是单个用户配置错误，而是长期反复出现的自动翻译字幕可靠性问题。
- Codex：协助实现脚本、使用 Surge CLI 验证配置、整理 README，并结合真实流量日志迭代调试。

### 参考

- YouTube Help Community: [Auto-translated subtitles issue thread](https://support.google.com/youtube/thread/368737344?sjid=5480931985540789392-NC)
- Reddit: [Auto translated subtitles no longer work?](https://www.reddit.com/r/youtube/comments/1meu9kx/auto_translated_subtitles_no_longer_work/)
- Reddit: [Anyone else having trouble with auto translated subtitles?](https://www.reddit.com/r/youtube/comments/1n0kvr6/anyone_else_having_trouble_with_auto_translated/)
- Reddit: [Subtitle auto translate not showing](https://www.reddit.com/r/youtube/comments/1n2b8g1/subtitle_auto_translate_english_not_showing_in/)
- GitHub: [ReVanced Extended issue #3147](https://github.com/inotia00/ReVanced_Extended/issues/3147)

### 状态

已验证：

- request 脚本会生成不带 `tlang` 的 clean `302 Location`。
- response 脚本能恢复目标语言并写回翻译后的 timedtext XML。
- Surge `--check` 能接受完整测试 profile 中的 Script + MITM 配置。
- 真实用户测试确认字幕可以成功加载。

## English

**YT AutoTrans Error** is a Surge module for the native YouTube app on iPhone and iPad. It fixes the recurring auto-translated subtitle failure where YouTube shows "error loading subtitles" and `/api/timedtext?...&tlang=...` returns `HTTP 429 Too Many Requests`.

The key idea is simple: **do not send the high-risk `tlang` request to YouTube.** The module stores the target language locally, redirects the app to a clean timedtext URL, receives the original subtitle XML, translates it locally, and returns the translated XML to the YouTube app.

### Scope

- Native YouTube app on iPhone / iPad.
- Auto-translated subtitles fail to load.
- Surge capture shows `/api/timedtext?...&tlang=...` returning `HTTP 429`.
- Especially useful in proxy environments where YouTube timedtext is sensitive to unclean exit IPs.

Desktop browsers are not the main target. Browser users can often use extensions such as Immersive Translate.

### Evidence

The YouTube app usually shows only a generic subtitle error:

![YouTube App subtitle loading error](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/youtube-subtitle-error.jpg)

Surge capture shows the underlying timedtext `429`:

![Surge capture showing YouTube timedtext 429 response](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/surge-429-response.png)

On slow networks, another failure mode is possible: YouTube already returns `200 OK`, but the response script is still waiting for translation, and the YouTube app closes the connection around the 8-second mark. Surge timing usually shows `Active` close to 8 seconds:

![Surge timing showing timedtext active near 8 seconds](https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/surge-active-timeout.jpg)

### Install

Surge module URL:

```text
https://github.com/CyberDoctor2023/yt-autotrans/releases/latest/download/yt-autotrans.sgmodule
```

After installation:

- Enable MITM for `www.youtube.com`.
- Remove old `/api/timedtext` URL Rewrite rules, especially rules that delete `tlang` before this module sees it.
- Do not add `translate.googleapis.com` to MITM. It is called by Surge's `$httpClient` inside the script.

### Options

The module uses Surge `#!arguments`. Defaults are usable as-is.

| Option | Default | Description |
| --- | --- | --- |
| `mode` | `dual` | Subtitle display mode |
| `version` | `v2026.05.01.8` | Visible GitHub Release marker only; scripts do not read it |

`mode` values:

| Value | Behavior |
| --- | --- |
| `dual` | Source above translation |
| `reverse` | Translation above source |
| `single` | Translation only |

### Flow

```text
YouTube App original request
  |
  | 1. /api/timedtext?...&lang=en&tlang=ja
  v
Surge request script
  |
  | 2. Save cleanUrl -> sourceLang / targetLang
  | 3. Return local 302 Location: cleanUrl
  v
YouTube App follows redirect
  |
  | 4. /api/timedtext?...&lang=en
  v
YouTube timedtext backend
  |
  | 5. 200 OK original subtitle XML
  v
Surge response script
  |
  | 6. Read target language and translate timedtext XML locally
  v
YouTube App displays translated subtitles
```

### Design Notes

- **Why not pure URL Rewrite?**
  Rewrite can remove `tlang`, but the response phase then loses the target language. That is not suitable for a global module where the YouTube client decides the target language.

- **Why not request URL mutation?**
  `$done({ url: cleanUrl })` was not reliable enough in real timedtext testing. A local 302 is more explicit: the original `tlang` request never goes upstream, and the script can save language metadata first.

- **How is the target language chosen?**
  It comes from the YouTube app's original `tlang`, such as `en -> ja`, `ko -> en`, or `es -> zh-CN`. Chinese is not hard-coded.

- **How are external scripts refreshed?**
  The local Surge CLI exposes `external-resource update <key>` and `external-resource update all`, but no module directive that forces script refresh on install. Releases therefore bump `#!version` and script URL `?v=...`, while also using `script-update-interval=3600`.

- **Why enforce a translation deadline?**
  Timedtext is a foreground subtitle response that the YouTube app is actively waiting for. Real captures show the client can close the connection when `Active` approaches about 8 seconds. The current version uses a 2-second Google Translate request timeout, translates at most 2 chunks per response, and keeps a 5-second response budget. If that budget is exceeded, the script returns quickly and writes `[YT AutoTrans] Google 翻译服务超时，请稍后重试。` into the subtitle so the failure is distinguishable from YouTube 429.

### TimedText Handling

YouTube iOS often returns srv3 timedtext XML:

```xml
<p t="160" d="4560" w="1">
  <s ac="0">Welcome</s><s t="320" ac="0"> to</s>
</p>
```

The response script preserves the timedtext shell and `<p>` timing attributes, then replaces subtitle text content.

Current behavior:

- Keep `<p>` timing and window attributes such as `t`, `d`, `w`, and `a`.
- Extract visible text from nested `<s>` nodes.
- Emit bilingual line breaks as `&#x000A;` instead of raw newlines.
- Separate manual captions from ASR auto-generated captions.
- Remove empty ASR roll-up spacers such as `<p ... a="1"></p>`.
- Normalize ASR left/roll-up windows toward bottom-centered captions.
- Widen ASR caption columns from common `cc=40` to `cc=80`.
- Split long ASR paragraphs by word timestamps, and enrich very short cues with nearby context.
- Clamp overlapping ASR durations to avoid bilingual captions stacking into extra lines.
- Write an explicit timeout subtitle if Google Translate is slow or fails and no translated text is available for the current response.

The script does not preserve original word-by-word `<s t="...">` timing, because English word timings cannot be reliably mapped to translated Chinese, Japanese, Korean, or other languages.

### Cache

The module uses two cache layers:

```text
cleanUrl -> { sourceLang, targetLang, expiresAt }
cleanUrl + targetLang -> translated paragraph map
```

Surge `http-response` scripts cannot stream subtitle chunks back progressively; they must call `$done(...)` once. The practical strategy is progressive caching: use cached lines immediately, translate at most 2 new chunks per response in the current version, and reuse cached translations on later requests for the same video and target language.

### Verification

This project was built with Codex and verified against local Surge CLI behavior:

```bash
/Applications/Surge.app/Contents/Applications/surge-cli --help
```

Checks used during development:

- `surge-cli --help`
- `surge-cli --check` with a complete test profile
- `surge-cli dump profile effective`
- `surge-cli watch request`
- `surge-cli external-resource update all`
- `node --check`

Note: `--check` expects a complete Surge profile. Checking a standalone `.sgmodule` can produce profile-level errors such as `Rules must end with FINAL`.

### Known Limits

- Translation quality depends on Google Translate's unofficial endpoint.
- If Google Translate rate-limits, fails, or exceeds the 5-second response budget, the script returns quickly; when no translation is available, it writes an explicit timeout subtitle for diagnosis.
- If YouTube changes the timedtext XML format, parser logic may need updates.
- If another module removes `tlang` before this request script sees it, target-language recovery fails.
- MITM must be enabled for `www.youtube.com`.

### Acknowledgements

- [@DualSubs](https://github.com/orgs/DualSubs/repositories) and [DualSubs/Universal](https://github.com/DualSubs/Universal), for earlier work on subtitle enhancement, `tlang`, subtitle modes, language-state caching, module arguments, and bilingual output design.
- NodeSeek community and TraderYao, for documenting the YouTube "加载字幕时错误" troubleshooting path and the observation that clean VPS exits or overseas SIM traffic can avoid the China-environment failure.
- Reddit, YouTube Help Community, and ReVanced Extended reports, for showing this is a broader long-running auto-translate subtitle reliability issue.
- Codex, for implementation assistance, Surge CLI verification, README drafting, and iterative debugging with live traffic logs.

### References

- YouTube Help Community: [Auto-translated subtitles issue thread](https://support.google.com/youtube/thread/368737344?sjid=5480931985540789392-NC)
- Reddit: [Auto translated subtitles no longer work?](https://www.reddit.com/r/youtube/comments/1meu9kx/auto_translated_subtitles_no_longer_work/)
- Reddit: [Anyone else having trouble with auto translated subtitles?](https://www.reddit.com/r/youtube/comments/1n0kvr6/anyone_else_having_trouble_with_auto_translated/)
- Reddit: [Subtitle auto translate not showing](https://www.reddit.com/r/youtube/comments/1n2b8g1/subtitle_auto_translate_english_not_showing_in/)
- GitHub: [ReVanced Extended issue #3147](https://github.com/inotia00/ReVanced_Extended/issues/3147)

### Status

Verified:

- the request script produces a clean `302 Location` without `tlang`;
- the response script recovers the target language and writes translated timedtext XML;
- Surge `--check` accepts the Script + MITM shape inside a complete test profile;
- live user testing confirmed subtitles load successfully.
