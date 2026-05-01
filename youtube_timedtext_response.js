let body = $response.body || "";
const url = $request.url;

function getParam(u, name) {
  const m = u.match(new RegExp("[?&]" + name + "=([^&]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function readPendingState(videoId) {
  if (!videoId) return null;

  const key = "yt_translate_pending_" + videoId;
  const raw = $persistentStore.read(key);

  if (!raw) return null;

  try {
    const state = JSON.parse(raw);
    const ttl = state.ttl || 30000;

    if (!state.target) return null;
    if (Date.now() - state.time > ttl) return null;

    // 关键：读到后立刻清空，避免后续所有字幕都变测试中文
    $persistentStore.write("", key);

    return state;
  } catch (e) {
    return null;
  }
}

const videoId = getParam(url, "v");
const state = readPendingState(videoId);

// 没有 pending：普通字幕完全不改
if (!state) {
  $done({});
  return;
}

// 有 pending：只替换这一次
const regex = /<p([^>]*)>([\s\S]*?)<\/p>/g;

let count = 0;

body = body.replace(regex, function (match, attrs, content) {
  count++;
  return "<p" + attrs + ">测试中文" + count + "</p>";
});

$done({
  body: body,
  headers: {
    ...$response.headers,
    "Content-Encoding": "identity",
    "Content-Type": "text/xml; charset=UTF-8"
  }
});
