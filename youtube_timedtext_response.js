let body = $response.body || "";

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
