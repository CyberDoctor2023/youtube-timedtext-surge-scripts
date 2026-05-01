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
#!desc=修复 YouTube iOS 自动翻译字幕 429 / Fix YouTube iOS auto-translated subtitle 429.
#!system=ios
#!icon=https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/assets/icon.svg
#!version=2026.05.01.7
#!arguments=mode:dual
#!arguments-desc=[模式 / Mode]\n\nmode=dual：双语，原文在上，译文在下；英译中时就是英中 / Source above translation.\n\nmode=reverse：双语，译文在上，原文在下；英译中时就是中英 / Translation above source.\n\nmode=single：单语，只显示译文 / Translation only.

[Script]
youtube-timedtext-request = type=http-request,pattern=^https:\/\/www\.youtube\.com\/api\/timedtext\?.*tlang=,timeout=5,script-update-interval=3600,script-path=https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/yt_autotrans_request.js?v=2026.05.01.7
youtube-timedtext-response = type=http-response,pattern=^https:\/\/www\.youtube\.com\/api\/timedtext\?,requires-body=true,max-size=2097152,timeout=60,script-update-interval=3600,argument=mode={{{mode}}},script-path=https://raw.githubusercontent.com/CyberDoctor2023/yt-autotrans/main/yt_autotrans_response.js?v=2026.05.01.7

[MITM]
hostname = %APPEND% www.youtube.com
```

注意：

- Surge 的模块/脚本列表里名称可能不够醒目，因此模块头部包含 `#!icon`。图标使用红色禁止符号和 `429`，用于直接表达“修复 YouTube 自动翻译字幕 429 错误”。
- 模块使用 Surge 参数表。参数只有一个：`mode`，默认值是 `dual`，不手动填写也会启用双语模式。
- `mode=dual`：双语，原文在上、译文在下，英译中时就是“英中”。`mode=reverse`：双语，译文在上、原文在下，英译中时就是“中英”。`mode=single`：单语，只显示译文。
- 远程脚本设置了 `script-update-interval=3600`，并带有版本参数 `?v=...`。Surge CLI 的 `--help` 只显示了 `external-resource update <key>` 和 `external-resource update all`，没有显示“模块更新时强制刷新全部脚本资源”的模块指令；因此本模块通过 bump `#!version` 和脚本 URL 版本号，让模块更新时脚本 URL 也变化，从而触发重新拉取。
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
- 删除自动生成字幕里的空白 roll-up spacer 段落，例如 `<p ... a="1"></p>`，避免双语字幕额外占行；
- 从嵌套 `<s>` 节点里提取字幕文本；
- 自动字幕过长时，会按词级 `<s>` 时间戳切成更短的 `<p>` 片段。分句器会参考标点、估算显示宽度和词数，再分别翻译并写回双语文本。当前版本放宽了单段阈值，避免字幕只剩一两个词。
- 对 YouTube 自动生成字幕常见的左侧 ASR 窗口做布局归一化：把 `ws id="1"` 的对齐改为居中，并把 `wp id="1"` 调整为底部居中的字幕窗口。这样处理的是 timedtext 自身的显示窗口，而不是简单往文本前面补空格。
- 对自动识别字幕和人工字幕做隔离：只有 URL 带 `kind=asr` 或 XML 呈现 ASR 结构时，才启用 ASR 专属的切分、删 spacer、居中窗口和重叠时长裁剪；人工字幕走保守替换路径。
- 自动识别字幕的窗口列宽 `cc` 会从常见的 `40` 放宽到 `80`，让 YouTube App 有更长的单行显示空间。
- 对一两个词或显示时间很短的 ASR cue，脚本会补入相邻上下文，让它显示为短语；这个过程不删除原始 `<p>`，避免跨段合并导致字幕丢失。
- 自动识别字幕经常是 roll-up 时间轴，多个 `<p>` 会重叠显示。脚本会把每个 ASR 输出片段的 `d` 裁到下一个片段开始前，避免双语字幕互相叠成三行。
- 双语换行写成 XML 数字实体 `&#x000A;`，而不是直接写真实换行字符；这是为了让 YouTube App 把双语识别成两行字幕，而不是把换行折叠成普通空白后自动排成三行。
- 把每个输出片段写回为单个 `<s ac="0">...</s>`。

它不会强行保留原来的逐词 `<s t="...">` 分段，因为英文词级时间戳无法可靠映射到中文、日文、韩文等翻译结果。

### 调试经验与踩坑记录

这个项目不是一次写完的，后续围绕 YouTube iOS 自动识别字幕踩过几轮坑，最终形成了现在的处理方式。

#### 1. 先证实 429，不先猜 XML

最初已经验证过 response 脚本可以直接把 timedtext XML 里的 `<p>` 文本替换成中文，YouTube App 也能显示。因此核心问题不是“Surge 不能改 XML”，而是带 `tlang` 的自动翻译请求在特定网络环境下会被 YouTube timedtext 返回 `429`。这也是为什么 request 脚本只负责拦截原始 `tlang` 请求、保存语言、返回本地 302，而不把原始请求发给 YouTube。

#### 2. 纯 URL Rewrite 能避开 429，但不能面向全球语言

URL Rewrite 删除 `tlang` 的确能让 YouTube 返回原始字幕，但 302 后 response 阶段已经看不到原始 `tlang`，也就不知道用户选择的是中文、日文、西语还是其他语言。这个方案适合硬编码单一目标语言，不适合由 YouTube 客户端决定目标语言的全球化使用场景。

#### 3. 人工字幕和 ASR 自动字幕必须隔离

人工字幕通常是一段一段完整 cue；ASR 自动识别字幕常见的是 word-timed、roll-up、带 `<w>` window、`w="1"`、`<s t="...">` 的结构。早期如果把 ASR 的居中、删 spacer、切分逻辑直接套到所有字幕，会影响人工字幕。所以现在只在检测到 `kind=asr` 或 ASR-like XML 结构时启用 ASR 专属修复，人工字幕只走保守替换。

#### 4. “三行字幕”不是单一原因

三行字幕至少遇到过三种来源：

- 原始 ASR 窗口偏左：`ws id="1"` / `wp id="1"` 指向 roll-up 风格窗口，需要把对齐改成居中，把窗口调到底部居中。
- 双语换行写成真实换行：YouTube timedtext renderer 可能把普通换行折叠成空白，所以改为 XML 数字实体 `&#x000A;`。
- ASR roll-up 时间轴重叠：多个 `<p>` 在同一时间段同时有效，双语后互相叠行。现在会把 ASR 输出段的 `d` 裁到下一个字幕开始前。

#### 5. `a="1"` 空白段会干扰双语显示

自动识别字幕里经常有空白 roll-up spacer：

```xml
<p t="3030" d="3130" w="1" a="1">
</p>
```

这些空白段对原始单行 roll-up 字幕有意义，但双语输出后容易额外占行或触发布局异常。现在 ASR 路径会删除这种空白 spacer，人工字幕不做这个处理。

#### 6. 跨 `<p>` 合并曾经试过，但已撤回

为了让字幕更像自然短语，曾经尝试把相邻短 `<p>` 真正合并成一个输出段，并删除后续原始 `<p>`。这个思路可以减少“一两个词一跳”，但风险是 paragraph 映射和翻译缓存会变得脆弱，实际测试里出现过只剩 `[Music]` 等短提示字幕能稳定显示的情况。

因此当前版本不再做跨 `<p>` 删除式合并。更稳的方式是：

- 放宽 ASR 单段切分阈值；
- 把窗口列宽从 `cc=40` 调到 `cc=80`；
- 对很短的 ASR cue 做上下文补全，只改当前 cue 文本，不删除原始 `<p>`。

这样可以减少机械的一词闪过，同时避免整段字幕丢失。

#### 7. Surge 外部脚本更新不能只靠直觉

本机 `surge-cli --help` 显示了：

```text
external-resource update <key>
external-resource update all
```

但没有显示“模块更新时强制刷新全部脚本资源”的模块指令。所以模块侧采用了两个策略：

- `script-update-interval=3600`；
- 每次发版 bump `#!version`，并给远程脚本 URL 加 `?v=...`。

这样用户更新模块时，脚本 URL 本身也变化，Surge 会把它当作新的外部资源重新拉取。

### 后续迭代记录

README 初版之后，项目继续围绕 iOS YouTube ASR 字幕做了多轮小步修正。下面记录这些后续变更，方便以后回溯为什么代码不是一个简单的“翻译后替换文本”。

#### `2026.05.01.2`：模块资源更新与 ASR 居中

- 给模块增加 `#!version`，并把远程脚本 URL 改成带 `?v=...` 的版本化地址。
- 保留 `script-update-interval=3600`，同时用版本化 URL 解决 Surge 外部脚本资源不立即刷新的问题。
- 给 ASR timedtext 增加 `normalizeTimedtextLayout()`：
  - `ws id="1"` 设置为居中对齐；
  - `wp id="1"` 设置为底部居中窗口；
  - 保持 `w id="1"` 指向 `wp="1"` 和 `ws="1"`。
- 这一步解决的是自动生成字幕常见的左侧/roll-up 窗口问题，但还不能单独解决三行字幕。

#### `2026.05.01.3`：双语换行和空白 spacer

- 把双语换行从真实换行字符改为 XML 数字实体 `&#x000A;`。
- 删除 ASR 里的空白 roll-up spacer，例如 `<p ... a="1"></p>`。
- 缓存版本同步升级，避免旧缓存继续输出旧格式。
- 这一步解决了 YouTube timedtext renderer 可能折叠普通换行、以及空白 spacer 额外占行的问题。

#### `2026.05.01.4`：人工字幕 / ASR 字幕隔离

- 增加 ASR 检测：`kind=asr`、`<w ... wp=...>`、`w="1"` + `<s t="...">` 等结构会被视为自动识别字幕。
- ASR 专属逻辑只在自动识别字幕上运行：
  - 居中窗口；
  - 删除 spacer；
  - 按词级时间戳切分；
  - 裁剪重叠时长。
- 人工字幕走保守路径，只替换文本，不套 ASR 的布局修复。
- 这一步是为了避免自动识别字幕的修复误伤已有字幕。

#### `2026.05.01.5`：跨 `<p>` 合并短句，后续撤回

- 曾尝试把相邻很短的 ASR `<p>` 合并成更长的字幕短语。
- 这个方向可以减少“一两个词一跳”，但需要把多个原始 paragraph 映射到一个输出 paragraph，并删除后续 paragraph。
- 实测发现它会让翻译缓存、marker 顺序和 paragraph 替换变脆弱，出现过只剩 `[Music]` 等短提示字幕稳定显示的情况。
- 因此这个版本的思路被撤回，不再作为当前设计。

#### `2026.05.01.6`：增加每行显示长度，恢复稳定

- 撤掉跨 `<p>` 删除式合并。
- 把 ASR 字幕窗口列宽从 `cc=40` 放宽到 `cc=80`。
- 把内部切分阈值从较短的 `60 / 10词` 放宽到 `92 / 16词`。
- 保留重叠时长裁剪，避免 roll-up 时间轴造成多行叠加。
- 这一步的目标是先恢复稳定显示，再减少字幕过短。

#### `2026.05.01.7`：短 cue 上下文补全

- 对一两个词、显示时间很短、或显示宽度很短的 ASR cue，补入前后相邻文本作为上下文。
- 不删除任何原始 `<p>`，不改变 paragraph 映射，只改变当前 cue 的文本内容。
- 跳过 `[Music]` 这类方括号提示，避免把提示音效和语句混在一起。
- 这是当前版本用来缓解“字幕太机械、单词快速闪过”的方式，比真正跨段合并更稳定。

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
external-resource update all - Update all external resources
--check/-c <path> - Check whether a profile is valid.
```

开发过程中使用过：

- `surge-cli --help` 确认当前 CLI 能力；
- `surge-cli --check` 验证完整测试 profile 中的 Script + MITM 配置；
- `surge-cli dump profile effective` 查看模块生效后的 profile；
- `surge-cli watch request` 和实际日志验证请求链路；
- `surge-cli external-resource update all` 确认外部资源只能由 CLI/客户端触发更新，模块侧采用版本化脚本 URL 解决发版刷新；
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
- Universal 模块的 `#!arguments` / `#!arguments-desc` 参数组织方式；
- `ShowOnly` 与 `Position` 这种“只显示翻译 / 双语顺序”的字幕输出思路。

但 YT AutoTrans Error 解决的是一个更窄的 Surge/iOS 问题：

```text
只处理 /api/timedtext XML response translation。
```

DualSubs 主要处理字幕轨道列表和 player response；YT AutoTrans Error 直接在拿到干净的 timedtext XML 后做本地翻译。

### 致谢

- [@DualSubs](https://github.com/orgs/DualSubs/repositories) 与 [DualSubs/Universal](https://github.com/DualSubs/Universal)：感谢其早期对字幕增强、`tlang`、字幕模式、语言状态缓存、模块参数和双语输出设计的探索。本项目部分参考了 DualSubs 的设计思路，但实现目标和处理链路更窄。
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
- Remote scripts use `script-update-interval=3600` and versioned URLs such as `?v=2026.05.01.7`. The local Surge CLI help exposes `external-resource update <key>` and `external-resource update all`, but no module directive that forcibly refreshes all external scripts when a module is updated. Versioned script URLs make each release a new resource URL, so Surge fetches the current scripts after module updates.
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

The response script preserves the timedtext XML shell, extracts visible text from nested `<s>` nodes, and separates manual captions from ASR captions. ASR captions are detected by `kind=asr` or ASR-like XML structure, then receive ASR-only handling: remove empty roll-up spacer paragraphs such as `<p ... a="1"></p>`, split only very long word-timed paragraphs, widen the caption window column count from `cc=40` to `cc=80`, enrich very short cues with nearby context without deleting source paragraphs, and clamp each segment duration before the next segment starts so overlapping roll-up cues do not stack into extra lines. Manual captions use the conservative replacement path.

For YouTube auto-generated captions that arrive in a left-aligned ASR window, the script also normalizes the timedtext head/window metadata: it changes the `ws id="1"` alignment toward center and moves `wp id="1"` toward a bottom-centered caption window. This targets the timedtext layout itself rather than padding the subtitle text with spaces.

Bilingual line breaks are written as the XML numeric entity `&#x000A;` instead of raw newline characters. This is important for YouTube's timedtext renderer: raw whitespace may be folded into normal spacing, while `&#x000A;` is intended to survive as a real caption line break.

The module exposes one Surge editable parameter through `#!arguments`: `mode`. Use `mode=dual` for source above translation, `mode=reverse` for translation above source, and `mode=single` for translation only.

### Debugging Notes

This project went through several iterations after the initial README. The current design is mostly the result of real iOS captures and failed alternatives.

#### 1. The XML replacement path was not the root problem

Direct response-body replacement was verified early: replacing timedtext `<p>` text with Chinese test strings worked in the YouTube iOS app. The failure was not "Surge cannot rewrite XML"; the real blocker was that upstream `/api/timedtext?...&tlang=...` requests could return `429` in affected network environments.

#### 2. Pure URL Rewrite avoids 429 but loses the target language

Deleting `tlang` with `[URL Rewrite]` can avoid the upstream 429, but after the local 302 the response script only sees the clean URL. It no longer knows whether the user asked for Chinese, Japanese, Spanish, or another target language. That is why the module uses a request script to save `lang/tlang` before returning a local 302.

#### 3. Manual captions and ASR captions must be separated

Manual captions usually arrive as normal cue paragraphs. YouTube ASR captions often arrive as word-timed roll-up XML with `<w>`, `w="1"`, and nested `<s t="...">` nodes. ASR-only layout fixes are now gated behind `kind=asr` or ASR-like XML detection, while manual captions use a conservative replacement path.

#### 4. The "three-line subtitle" issue had multiple causes

The three-line display was not caused by only one thing:

- ASR windows can be left-aligned or roll-up styled, so `ws/wp` metadata is normalized toward a bottom-centered caption window.
- Raw newline characters may be folded by YouTube's timedtext renderer, so bilingual line breaks are emitted as `&#x000A;`.
- ASR roll-up cues can overlap in time, so ASR output durations are clamped before the next cue starts.

#### 5. Empty `a="1"` roll-up spacer paragraphs matter

ASR captions often contain empty spacer paragraphs such as:

```xml
<p t="3030" d="3130" w="1" a="1">
</p>
```

These can make sense for original roll-up captions, but they can add unwanted layout rows after bilingual rewriting. The ASR path removes them; the manual-caption path does not.

#### 6. Real cross-`<p>` merging was tried and removed

Merging adjacent short `<p>` cues into one output paragraph sounded attractive, but it made paragraph mapping and translation caching fragile. In testing, that approach could make most captions disappear while short hints like `[Music]` still showed. The current approach is safer: widen the ASR caption window, relax internal splitting, and enrich very short cues with nearby context without deleting source paragraphs.

#### 7. External resource updates are handled by versioned script URLs

The local Surge CLI help exposes `external-resource update <key>` and `external-resource update all`, but no module directive that forces all external scripts to refresh whenever a module is updated. For releases, the module therefore bumps both `#!version` and the script URL query, such as `?v=2026.05.01.7`.

### Iteration Log

After the first README draft, the project continued through several iOS ASR subtitle fixes. This log records what changed after the initial documentation, including the approaches that were later reverted.

#### `2026.05.01.2`: resource versioning and ASR centering

- Added `#!version` to the module and versioned remote script URLs with `?v=...`.
- Kept `script-update-interval=3600`, while using the URL version query to force a fresh external script resource after module updates.
- Added `normalizeTimedtextLayout()` for ASR timedtext:
  - center-align `ws id="1"`;
  - move `wp id="1"` toward a bottom-centered caption window;
  - keep `w id="1"` bound to `wp="1"` and `ws="1"`.
- This addressed left-aligned or roll-up ASR windows, but did not fully solve the three-line display by itself.

#### `2026.05.01.3`: bilingual line breaks and spacer removal

- Changed bilingual line breaks from raw newline characters to the XML numeric entity `&#x000A;`.
- Removed empty ASR roll-up spacer paragraphs such as `<p ... a="1"></p>`.
- Bumped the cache version so stale translated output would not keep the old layout.
- This fixed raw-newline folding and spacer rows that could create extra visual lines.

#### `2026.05.01.4`: manual caption / ASR isolation

- Added ASR detection through `kind=asr`, `<w ... wp=...>`, and `w="1"` plus nested `<s t="...">`.
- Limited ASR-only behavior to auto-generated captions:
  - layout normalization;
  - spacer removal;
  - word-timed splitting;
  - overlapping-duration clamping.
- Manual captions use the conservative replacement path.
- This prevented ASR-specific fixes from affecting existing human-authored captions.

#### `2026.05.01.5`: cross-`<p>` short cue merging, later removed

- Tried merging adjacent short ASR `<p>` cues into longer phrases.
- This reduced one-word flashes, but required mapping multiple source paragraphs to one output paragraph and deleting later paragraphs.
- In real testing, the mapping and cache became fragile; most captions could disappear while short hints like `[Music]` still appeared.
- This strategy was removed and is not part of the current design.

#### `2026.05.01.6`: wider caption lines for stability

- Removed cross-`<p>` deletion-style merging.
- Widened the ASR caption window from `cc=40` to `cc=80`.
- Relaxed internal splitting from roughly `60 / 10 words` to `92 / 16 words`.
- Kept overlapping-duration clamping for roll-up timelines.
- The goal was to restore stable display first, then reduce overly short cues.

#### `2026.05.01.7`: context enrichment for short cues

- Very short ASR cues now borrow nearby context from adjacent cues.
- No source paragraph is deleted, and paragraph mapping remains stable.
- Bracket cues such as `[Music]` are skipped so sound-effect labels do not get mixed into spoken lines.
- This is the current approach for reducing mechanical one-word flashes without reintroducing the cross-paragraph merge failure.

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
external-resource update all - Update all external resources
--check/-c <path> - Check whether a profile is valid.
```

Development checks included `surge-cli --help`, `surge-cli --check` against a complete test profile, `dump profile effective`, `watch request`, `external-resource update all`, `node --check`, and local simulation of clean URL metadata lookup.

### FAQ

#### Is this for desktop users?

Not primarily. Desktop browser users can often use Immersive Translate or similar extensions. YT AutoTrans Error focuses on the native YouTube iOS app, where browser extensions cannot intercept and repair the subtitle request pipeline.

#### Do I need MITM for `translate.googleapis.com`?

No. MITM is only needed for `www.youtube.com`, because Surge must inspect and modify the YouTube App's timedtext request and response. `translate.googleapis.com` is requested by Surge's script through `$httpClient.get`.

#### Can this coexist with other rewrite modules?

Yes, but do not keep any rule that rewrites `/api/timedtext?...tlang=...` before YT AutoTrans Error sees it. If another module deletes `tlang` first, YT AutoTrans Error cannot know the requested target language.

### Relationship To DualSubs

This project partially references and learns from the now-broken DualSubs approach and NodeSeek community troubleshooting around YouTube "加载字幕时错误".

DualSubs inspired language-state caching, `tlang` handling, subtitle mode/type thinking, YouTube caption metadata investigation, Universal-style module parameters, and the `ShowOnly` / `Position` idea for bilingual output. But YT AutoTrans Error solves a narrower Surge/iOS problem: only `/api/timedtext` XML response translation after obtaining a clean upstream response.

### Acknowledgements

- [@DualSubs](https://github.com/orgs/DualSubs/repositories) and [DualSubs/Universal](https://github.com/DualSubs/Universal), for earlier exploration of subtitle enhancement, `tlang`, subtitle modes, language-state caching, module parameters, and bilingual output design.
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
