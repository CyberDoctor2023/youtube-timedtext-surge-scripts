let url = $request.url;

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

const target = getParam(url, "tlang");

if (!target) {
  $done({});
} else {
  let newUrl = removeParam(url, "tlang");
  newUrl = removeParam(newUrl, "_yt_x");
  newUrl = removeParam(newUrl, "_yt_trg");
  newUrl = removeParam(newUrl, "subtype");
  newUrl = removeParam(newUrl, "dst");

  let headers = {};
  for (let k in $request.headers) {
    headers[k] = $request.headers[k];
  }

  // 只标记当前这一次请求
  headers["X-YT-TT-Hit"] = "1";
  headers["X-YT-TT-Target"] = target;

  $done({
    url: newUrl,
    headers: headers
  });
}
