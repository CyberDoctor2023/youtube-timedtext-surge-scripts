let body = $response.body || "";

const TARGET_LANG = "zh-CN";

function decodeXml(str) {
  return String(str || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function encodeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractText(content) {
  content = String(content || "");

  if (/<s\b[^>]*>[\s\S]*?<\/s>/.test(content)) {
    let words = [];

    content.replace(/<s\b[^>]*>([\s\S]*?)<\/s>/g, function (_, word) {
      words.push(decodeXml(word));
      return _;
    });

    return words.join(" ").replace(/\s+/g, " ").trim();
  }

  return decodeXml(content)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function translateOne(text, callback) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx" +
    "&sl=auto" +
    "&tl=" + encodeURIComponent(TARGET_LANG) +
    "&dt=t" +
    "&q=" + encodeURIComponent(text);

  $httpClient.get(url, function (error, response, data) {
    if (error || !data) {
      callback("【翻译失败】");
      return;
    }

    try {
      const json = JSON.parse(data);
      const translated = json[0].map(function (x) {
        return x[0];
      }).join("").trim();

      callback(translated || "【翻译为空】");
    } catch (e) {
      callback("【翻译解析失败】");
    }
  });
}

const regex = /<p([^>]*)>([\s\S]*?)<\/p>/g;
const matches = [];
let m;

while ((m = regex.exec(body)) !== null) {
  const text = extractText(m[2]);
  matches.push({
    attrs: m[1],
    content: m[2],
    text: text
  });
}

if (!matches.length) {
  $done({ body });
} else {
  let translatedList = new Array(matches.length);
  let index = 0;

  function next() {
    if (index >= matches.length) {
      let i = 0;

      body = body.replace(regex, function (match, attrs, content) {
        const original = extractText(content);

        if (!original) {
          i++;
          return match;
        }

        const translated = translatedList[i] || "【翻译失败】";
        i++;

        return "<p" + attrs + ">" + encodeXml(translated) + "</p>";
      });

      $done({
        body: body,
        headers: {
          ...$response.headers,
          "Content-Encoding": "identity",
          "Content-Type": "text/xml; charset=UTF-8"
        }
      });

      return;
    }

    if (!matches[index].text) {
      translatedList[index] = "";
      index++;
      next();
      return;
    }

    translateOne(matches[index].text, function (translated) {
      translatedList[index] = translated;
      index++;
      next();
    });
  }

  next();
}
