let body = $response.body || "";

function getHeader(headers, name) {
  const lower = name.toLowerCase();

  for (let k in headers) {
    if (k.toLowerCase() === lower) {
      return headers[k];
    }
  }

  return "";
}

const hit = getHeader($request.headers || {}, "X-YT-TT-Hit");
const target = getHeader($request.headers || {}, "X-YT-TT-Target");

// 没有当次请求标记：普通字幕不改
if (hit !== "1") {
  $done({});
  return;
}

// 有当次请求标记：只替换这一次 response
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
    "Content-Type": "text/xml; charset=UTF-8",
    "X-YT-Debug": "HEADER_HIT;target=" + target + ";count=" + count
  }
});
