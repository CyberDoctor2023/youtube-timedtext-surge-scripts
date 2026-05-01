let url = $request.url;

const TTL = 60000; // 60 秒

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

const target = getParam(url, "tlang");

if (target) {
  let cleanUrl = removeParam(url, "tlang");
  cleanUrl = removeParam(cleanUrl, "_yt_x");
  cleanUrl = removeParam(cleanUrl, "_yt_trg");

  const key = "yt_tt_" + simpleHash(cleanUrl);

  $persistentStore.write(JSON.stringify({
    target: target,
    time: Date.now(),
    ttl: TTL
  }), key);

  $done({ url: cleanUrl });
} else {
  $done({});
}
