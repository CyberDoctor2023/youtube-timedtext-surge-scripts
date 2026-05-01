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

  // 存目标语言，但不放进最终 URL
  $persistentStore.write(target, "yt_tt_tlang");

  // 删除会触发 429 的参数
  u.searchParams.delete("tlang");

  // 清理旧残留
  u.searchParams.delete("_yt_x");
  u.searchParams.delete("_yt_trg");
  u.searchParams.delete("dst");

  // 借鉴 DualSubs：只标记当次请求类型
  u.searchParams.set("subtype", "Translate");

  $done({
    url: u.toString()
  });
}
