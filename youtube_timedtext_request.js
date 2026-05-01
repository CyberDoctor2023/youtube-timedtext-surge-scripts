let url = $request.url;

function getParam(u, name) {
  const m = u.match(new RegExp("[?&]" + name + "=([^&]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}

const target = getParam(url, "tlang");

if (!target) {
  $done({});
} else {
  const u = new URL(url);

  u.searchParams.delete("tlang");
  u.searchParams.delete("_yt_x");
  u.searchParams.delete("_yt_trg");

  u.searchParams.set("subtype", "Translate");
  u.searchParams.set("dst", target);

  $done({ url: u.toString() });
}
