const TARGET_LANG = "zh-CN";
let body = $response.body || "";

function decodeXml(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function encodeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function translateOne(text, callback) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx" +
    "&sl=auto" +
    "&tl=" + TARGET_LANG +
    "&dt=t" +
    "&q=" + encodeURIComponent(text);

  $httpClient.get(url, function (error, response, data) {
    if (error || !data) {
      console.log("翻译失败，保留原文: " + text);
      callback(text);
      return;
    }

    try {
      const json = JSON.parse(data);
      const translated = json[0].map(x => x[0]).join("");
      callback(translated || text);
    } catch (e) {
      console.log("翻译解析失败，保留原文: " + e);
      callback(text);
    }
  });
}

const regex = /<p([^>]*)>([\s\S]*?)<\/p>/g;
const matches = [...body.matchAll(regex)];

if (!matches.length) {
  console.log("没找到 <p> 字幕节点");
  $done({ body });
} else {
  console.log("找到字幕条数: " + matches.length);

  let originals = matches.map(m =>
    decodeXml(m[2]).replace(/\s+/g, " ").trim()
  );

  let translated = new Array(originals.length);
  let finished = 0;

  originals.forEach((text, index) => {
    if (!text) {
      translated[index] = "";
      finished++;
      return;
    }

    translateOne(text, function (zh) {
      translated[index] = zh;
      finished++;

      if (finished === originals.length) {
        let i = 0;

        body = body.replace(regex, function (match, attrs, content) {
          const original = decodeXml(content).replace(/\s+/g, " ").trim();

          if (!original) return match;

          const zh = translated[i] || original;
          i++;

          return `<p${attrs}>${encodeXml(zh)}</p>`;
        });

        console.log("字幕翻译完成，替换数量: " + i);

        $done({
          body,
          headers: {
            ...$response.headers,
            "Content-Encoding": "identity",
            "Content-Type": "text/xml; charset=UTF-8"
          }
        });
      }
    });
  });
}
