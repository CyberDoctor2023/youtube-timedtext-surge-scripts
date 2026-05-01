let body = $response.body || "";
const u = new URL($request.url);

const subtype = u.searchParams.get("subtype");

// 只处理 request 阶段由 tlang 改写出来的当次请求
if (subtype !== "Translate") {
  $done({});
  return;
}

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
});let body = $response.body || "";
const u = new URL($request.url);

const subtype = u.searchParams.get("subtype");

// 只处理 request 阶段由 tlang 改写出来的当次请求
if (subtype !== "Translate") {
  $done({});
  return;
}

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
