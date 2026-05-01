let body = $response.body || "";
const url = $request.url;

function removeParam(u, name) {
  const qIndex = u.indexOf("?");
  if (qIndex === -1) return u;

  const base = u.slice(0, qIndex);
  const query = u.slice(qIndex + 1);

  const kept = query
    .split("&")
    .filter(function (part) {
      if (!part) return false;
      return part.split("=")[0] !== name;
    });

  return kept.length ? base + "?" + kept.join("&") : base;
}

function simpleHash(str) {
  let h = 2166136261;

  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }

  return (h >>> 0).toString(16);
}

function readStateForUrl(u) {
  let cleanUrl = removeParam(u, "tlang");
  cleanUrl = removeParam(cleanUrl, "_yt_x");
  cleanUrl = removeParam(cleanUrl, "_yt_trg");

  const key = "yt_tt_" + simpleHash(cleanUrl);
  const raw = $persistentStore.read(key);

  if (!raw) return null;

  try {
    const state = JSON.parse(raw);
    const ttl = state.ttl || 60000;

    if (!state.target) return null;
    if (Date.now() - state.time > ttl) return null;

    return state;
  } catch (e) {
    return null;
  }
}

const state = readStateForUrl(url);

// 没有 cleanUrl 对应状态：普通字幕不改
if (!state) {
  $done({});
  return;
}

// 命中由 tlang 改写来的那条请求：才替换测试中文
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
