const body =
  '<?xml version="1.0" encoding="utf-8" ?>' +
  '<timedtext format="3">' +
  '<body>' +
  '<p t="0" d="3000">测试中文一</p>' +
  '<p t="3000" d="3000">测试中文二</p>' +
  '<p t="6000" d="3000">测试中文三</p>' +
  '<p t="9000" d="3000">测试中文四</p>' +
  '</body>' +
  '</timedtext>';

function byteLength(str) {
  return unescape(encodeURIComponent(String(str || ""))).length;
}

let headers = {};
for (let k in $response.headers) {
  headers[k] = $response.headers[k];
}

delete headers["Content-Length"];
delete headers["content-length"];
delete headers["Transfer-Encoding"];
delete headers["transfer-encoding"];
delete headers["Content-Encoding"];
delete headers["content-encoding"];

headers["Content-Type"] = "text/xml; charset=UTF-8";
headers["Content-Encoding"] = "identity";
headers["Cache-Control"] = "no-cache";
headers["Pragma"] = "no-cache";
headers["Expires"] = "Fri, 01 Jan 1990 00:00:00 GMT";
headers["Content-Length"] = String(byteLength(body));
headers["X-YT-Debug"] = "FORCE_CHINESE_RESPONSE_TEST";

$done({
  status: 200,
  headers: headers,
  body: body
});
