let body = $response.body || "";
const url = $request.url;

const DEFAULT_TARGET = "zh-CN";

function getParam(u, name) {
  const m = u.match(new RegExp("[?&]" + name + "=([^&]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function readActiveState(videoId) {
  const now = Date.now();

  const keys = [];
  if (videoId) keys.push("yt_translate_state_" + videoId);
  keys.push("yt_translate_last_state");

  for (let i = 0; i < keys.length; i++) {
    const raw = $persistentStore.read(keys[i]);
    if (!raw) continue;

    try {
      const state = JSON.parse(raw);
      const ttl = state.ttl || 180000;

      if (!state.target) continue;
      if (now - state.time > ttl) continue;

      // 防止串视频
      if (videoId && state.videoId && state.videoId !== videoId) continue;

      return state;
    } catch (e) {}
  }

  return null;
}

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

  // 兼容 <p><s>word</s><s>word</s></p>
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

function googleTranslate(text, callback) {
  const api =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx" +
    "&sl=auto" +
    "&tl=" + encodeURIComponent(DEFAULT_TARGET) +
    "&dt=t" +
    "&q=" + encodeURIComponent(text);

  $httpClient.get(api, function (error, response, data) {
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

const videoId = getParam(url, "v");
const state = readActiveState(videoId);

// 关键：没有自动翻译状态，原字幕完全不动
if (!state) {
  $done({});
  return;
}

const regex = /<p([^>]*)>([\s\S]*?)<\/p>/g;
const matches = [];
let match;

while ((match = regex.exec(body)) !== null) {
  const text = extractText(match[2]);

  if (text) {
    matches.push({
      full: match[0],
      attrs: match[1],
      content: match[2],
      text: text
    });
  }
}

if (!matches.length) {
  $done({ body });
  return;
}

let translatedList = new Array(matches.length);
let index = 0;

function next() {
  if (index >= matches.length) {
    let i = 0;

    body = body.replace(regex, function (whole, attrs, content) {
      const original = extractText(content);

      if (!original) {
        return whole;
      }

      const translated = translatedList[i] || "【翻译失败】";
      i++;

      return "<p" + attrs + ">" + encodeXml(translated) + "</p>";
    });

    const headers = { ...$response.headers };

    delete headers["Content-Length"];
    delete headers["content-length"];
    delete headers["Transfer-Encoding"];
    delete headers["transfer-encoding"];

    headers["Content-Encoding"] = "identity";
    headers["Content-Type"] = "text/xml; charset=UTF-8";

    $done({
      body: body,
      headers: headers
    });

    return;
  }

  googleTranslate(matches[index].text, function (translated) {
    translatedList[index] = translated;
    index++;
    next();
  });
}

next();
