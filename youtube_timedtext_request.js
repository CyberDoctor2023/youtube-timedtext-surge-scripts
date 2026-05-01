let url = $request.url;

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

// 只删除会触发 429 的参数
let newUrl = removeParam(url, "tlang");
newUrl = removeParam(newUrl, "_yt_x");
newUrl = removeParam(newUrl, "_yt_trg");

if (newUrl !== url) {
  $done({ url: newUrl });
} else {
  $done({});
}
