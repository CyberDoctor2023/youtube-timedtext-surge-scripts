let url = $request.url;

const ACTIVE_TTL = 180000; // 3分钟

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
    .filter(function (part) {
      if (!part) return false;
      const key = part.split("=")[0];
      return key !== name;
    });

  return kept.length ? base + "?" + kept.join("&") : base;
}

const videoId = getParam(url, "v");
const target = getParam(url, "tlang");

// 只有用户点“自动翻译”时才会有 tlang
if (target) {
  const state = JSON.stringify({
    videoId: videoId || "",
    target: target,
    time: Date.now(),
    ttl: ACTIVE_TTL
  });

  // 按视频保存
  if (videoId) {
    $persistentStore.write(state, "yt_translate_state_" + videoId);
  }

  // 兜底保存
  $persistentStore.write(state, "yt_translate_last_state");

  // 删除会触发 429 的参数
  let newUrl = removeParam(url, "tlang");

  // 清理旧残留
  newUrl = removeParam(newUrl, "_yt_x");
  newUrl = removeParam(newUrl, "_yt_trg");

  $done({ url: newUrl });
} else {
  $done({});
}
