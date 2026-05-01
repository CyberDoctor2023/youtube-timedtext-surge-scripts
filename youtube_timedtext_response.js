let body = $response.body || "";
const url = $request.url;

function getParam(u, name) {
  const m = u.match(new RegExp("[?&]" + name + "=([^&]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function readActiveState(videoId) {
  const now = Date.now();
  const keys = [];

  if (videoId) keys.push("yt_translate_state_" + videoId);
  keys.push("yt_translate_last_state");

  for (let i = 0; i < keys.length; i++) {
    const raw = $persistentStore.read(keys[i]);
    if (!raw) continue;

    try {
      const state = JSON.parse(raw);
      const ttl = state.ttl || 180000;

      if (!state.target) continue;
      if (now - state.time > ttl) continue;
      if (videoId && state.videoId && state.videoId !== videoId) continue;

      return state;
    } catch (e) {}
  }

  return null;
}

const videoId = getParam(url, "v");
const state = readActiveState(videoId);

// 没有自动翻译状态：原样放行，普通英文字幕不动
if (!state) {
  $done({});
  return;
}

// 有自动翻译状态：才替换成测试中文
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
