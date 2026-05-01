# YT AutoTrans Error for Quantumult X

![Quantumult X](https://img.shields.io/badge/Quantumult%20X-iOS%20%2F%20Mac-7A5CFF)
![YouTube](https://img.shields.io/badge/YouTube-TimedText-FF0000)
![Status](https://img.shields.io/badge/Status-Tested-brightgreen)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

**语言 / Language**：[中文](quantumult-x.zh.md) | [English](quantumult-x.en.md)

## 中文

**YT AutoTrans Error for Quantumult X** 是面向 iPhone / iPad 原生 YouTube App 的 Quantumult X 版本，用来修复自动翻译字幕反复出现的“加载字幕时错误”问题。

在受影响的网络环境里，YouTube App 自动翻译字幕会请求：

```text
https://www.youtube.com/api/timedtext?...&lang=en&tlang=zh-Hant&format=json3
```

只要最终发给 YouTube timedtext 后端的请求带有 `tlang`，就可能返回 `HTTP 429 Too Many Requests`。Quantumult X 版本的核心做法是：**在请求发出前删除 `tlang`，本地保存目标语言，再把返回的原始字幕在本地翻译并写回给 YouTube App。**

### 文件

```text
yt_autotrans_quanx.js
yt-autotrans.quanx.conf
```

- `yt_autotrans_quanx.js`：Quantumult X 单脚本，同时处理 request 和 response。
- `yt-autotrans.quanx.conf`：完整 Quantumult X 配置示例。

### 适用场景

- iPhone / iPad 原生 YouTube App。
- YouTube 自动翻译字幕显示“加载字幕时错误”。
- Quantumult X 记录里能看到 `/api/timedtext?...&tlang=...`。
- 代理出口 IP 容易触发 YouTube timedtext 429。
- 需要双语字幕，默认原文在上、译文在下。

### 安装

1. 把 `yt_autotrans_quanx.js` 放到：

```text
我的 iPhone/Quantumult X/Scripts/yt_autotrans_quanx.js
```

或：

```text
iCloud Drive/Quantumult X/Scripts/yt_autotrans_quanx.js
```

2. 在 Quantumult X 配置里加入：

```ini
[rewrite_local]
^https://www\.youtube\.com/api/timedtext\?.*tlang= url script-request-header yt_autotrans_quanx.js
^https://www\.youtube\.com/api/timedtext\? url script-response-body yt_autotrans_quanx.js

[mitm]
hostname = www.youtube.com
```

也可以直接导入 `yt-autotrans.quanx.conf` 作为完整配置示例。

3. 打开 Quantumult X 的 Rewrite。
4. 打开 Quantumult X 的 MitM。
5. 安装并信任 Quantumult X CA 证书。
6. 确认 MitM hostname 包含 `www.youtube.com`。
7. 杀掉 YouTube App 后重新打开，选择自动翻译字幕。

### 工作原理

```text
YouTube App 原始请求
  |
  | 1. /api/timedtext?...&lang=en&tlang=zh-Hant
  v
Quantumult X request 脚本
  |
  | 2. 保存 cleanUrl -> sourceLang / targetLang
  | 3. 直接把请求 URL 改成 cleanUrl，不再发送 tlang
  v
YouTube timedtext 后端
  |
  | 4. 返回原始字幕 XML 或 JSON3
  v
Quantumult X response 脚本
  |
  | 5. 读取目标语言，本地调用 Google Translate
  | 6. 写回双语字幕
  v
YouTube App 显示字幕
```

### 为什么 Quantumult X 版不用 302

Surge 版本使用 request 阶段本地返回 `302 Location: cleanUrl`。但在部分 Quantumult X + YouTube App 环境里，YouTube App 对本地 302 跟随不够稳定，可能已经触发 `request OK` 通知但仍显示“加载字幕时错误”。

Quantumult X 版本改用：

```ini
script-request-header
```

脚本执行：

```js
$done({ url: cleanUrl });
```

这样 YouTube App 看起来只是发出了一次正常的 clean timedtext 请求，不依赖本地 302 跳转。

### 字幕格式

Quantumult X 版本支持两类 YouTube timedtext 返回：

- XML / srv3：`<p>`、`<s>` 节点。
- JSON3：`events` / `segs` 字幕结构。

JSON3 字幕会被改成：

```json
{
  "utf8": "Hello world\n你好世界"
}
```

XML 字幕会被改成：

```xml
<s ac="0">Hello world&#x000A;你好世界</s>
```

### 通知

脚本会用 Quantumult X 通知辅助排查：

```text
YT AutoTrans
request rewrite OK
en -> zh-Hant
```

表示请求阶段已经删除 `tlang`。

```text
YT AutoTrans
json3 OK
2/2 translated
```

表示 JSON3 字幕已写回双语。

```text
YT AutoTrans
response OK
2/2 translated
```

表示 XML 字幕已写回双语。

### 字幕模式

默认是双语：

```js
const DEFAULT_OPTIONS = {
  showOnly: false,
  position: "Forward"
};
```

效果：

```text
原文
译文
```

如果要改成只显示译文，可以编辑脚本：

```js
showOnly: true
```

如果要译文在上、原文在下，可以改成：

```js
position: "Reverse"
```

### 缓存

脚本使用两层缓存：

```text
cleanUrl -> { sourceLang, targetLang, expiresAt }
cleanUrl + targetLang -> translated subtitle map
```

这样同一个视频、同一种目标语言重复打开时，可以复用已经翻译过的字幕。

### 验证

本版本经过以下检查：

```bash
node --check yt_autotrans_quanx.js
```

并在 macOS Quantumult X 中验证：

- 带 `tlang` 的 timedtext 请求命中 `script-request-header`。
- clean timedtext 响应命中 `script-response-body`。
- JSON3 英文字幕可以被转换成英文 + 中文双语 payload。
- Google Translate 非正式接口可返回中文翻译。

### 已知限制

- 翻译质量取决于 Google Translate 非正式接口。
- 如果 Google Translate 限流或失败，部分字幕可能暂时保留原文。
- 如果其他规则先删除 `tlang`，脚本无法知道目标语言。
- 必须给 `www.youtube.com` 开启 MitM。
- 如果 YouTube 改变 timedtext XML 或 JSON3 结构，脚本可能需要更新。

### 排查

如果仍然只有英文字幕：

- 确认通知是不是 `request rewrite OK`，不是旧版的 `request OK`。
- 确认手机里的 `yt_autotrans_quanx.js` 已经替换成最新版。
- 确认 response 阶段是否出现 `json3 OK` 或 `response OK`。
- 确认 `translate.googleapis.com` 能访问。
- 删除其他 YouTube 字幕相关重写规则后再试。

如果仍然显示“加载字幕时错误”：

- 确认 MitM 证书已经安装并信任。
- 确认 `www.youtube.com` 在 MitM hostname 中。
- 确认 Rewrite 总开关已打开。
- 确认脚本文件在 `Quantumult X/Scripts/` 目录，并且文件名完全是 `yt_autotrans_quanx.js`。
