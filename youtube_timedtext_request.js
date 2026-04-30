let url = $request.url;

const ACTIVE_TTL = 180000; // 3 分钟

function getParam(u, name) {
  const m = u.match(new RegExp("[?&]" + name + "=([^&]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function removeParam(u, name) {
  const qIndex = u.indexOf("?");
  if (qIndex === -1) return u;

  const base = u.slice(0, qIndex);
  const query = u.slice(qIndex + 1);

  const kept = query
    .split("&")
    .filter(part => {
      if (!part) return false;
      const key = part.split("=")[0];
      return key !== name;
    });

  return kept.length ? base + "?" + kept.join("&") : base;
}

const videoId = getParam(url, "v");
const target = getParam(url, "tlang");

// 用户点击 YouTube 自动翻译字幕时，URL 会带 tlang。
// 这里保存目标语言，然后删除 tlang，避免 YouTube 后端返回 429。
if (target) {
  const state = JSON.stringify({
    videoId: videoId || "",
    target: target,
    time: Date.now(),
    ttl: ACTIVE_TTL
  });

  if (videoId) {
    $persistentStore.write(state, "yt_translate_state_" + videoId);
  }

  // 全局兜底，response 里会校验 videoId，避免串视频。
  $persistentStore.write(state, "yt_translate_last_state");

  let newUrl = removeParam(url, "tlang");

  // 清理历史残留，最终发给 YouTube 的 URL 不能有这些。
  newUrl = removeParam(newUrl, "_yt_x");
  newUrl = removeParam(newUrl, "_yt_trg");

  $done({ url: newUrl });
} else {
  $done({});
}
