const TARGET_LANG = "zh-CN";
const SOURCE_LANG = "auto";
const TRANSLATE_SOURCE_LANGS = ["en"];
const REQUEST_TIMEOUT = 5;
const MAX_URL_LENGTH = 5000;
const MAX_CHUNKS = 8;

let body = $response.body || "";
let headers = Object.assign({}, $response.headers || {});

const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/g;
const sRegex = /<s\b[^>]*>([\s\S]*?)<\/s>/g;
const markerRegex = /@@YT(\d+)@@([\s\S]*?)(?=@@YT\d+@@|$)/g;

function getRequestSourceLang() {
  try {
    const url = new URL($request.url);
    return String(url.searchParams.get("lang") || "").toLowerCase();
  } catch (e) {
    return "";
  }
}

function shouldTranslateSourceLang(lang) {
  if (!lang) {
    return false;
  }

  return TRANSLATE_SOURCE_LANGS.some(function (allowedLang) {
    return lang === allowedLang || lang.indexOf(allowedLang + "-") === 0;
  });
}

function decodeXml(text) {
  return String(text || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function encodeXml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractText(content) {
  let text = "";
  let match;

  sRegex.lastIndex = 0;

  while ((match = sRegex.exec(content)) !== null) {
    text += decodeXml(match[1]);
  }

  if (text.trim()) {
    return text.trim();
  }

  return decodeXml(String(content || "").replace(/<[^>]+>/g, "")).trim();
}

function normalizeHeaders() {
  delete headers["Content-Encoding"];
  delete headers["content-encoding"];
  delete headers["Content-Type"];
  delete headers["content-type"];
  delete headers["Content-Length"];
  delete headers["content-length"];
  delete headers["Transfer-Encoding"];
  delete headers["transfer-encoding"];

  headers["Content-Encoding"] = "identity";
  headers["Content-Type"] = "text/xml; charset=UTF-8";
}

function finish(items, translatedCount) {
  let index = 0;

  body = body.replace(pRegex, function (match, attrs, content) {
    const item = items[index];
    index += 1;

    if (!item || !item.translated) {
      return match;
    }

    return "<p" + attrs + "><s ac=\"0\">" + encodeXml(item.translated) + "</s></p>";
  });

  normalizeHeaders();

  console.log("YouTube timedtext translated: " + translatedCount + "/" + items.length);

  $done({
    body: body,
    headers: headers
  });
}

function parseGoogleTranslate(data) {
  const json = JSON.parse(data);
  let result = "";

  if (!json || !json[0]) {
    return "";
  }

  for (let index = 0; index < json[0].length; index += 1) {
    if (json[0][index] && json[0][index][0]) {
      result += json[0][index][0];
    }
  }

  return result;
}

function translateText(text, callback) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx" +
    "&sl=" + encodeURIComponent(SOURCE_LANG) +
    "&tl=" + encodeURIComponent(TARGET_LANG) +
    "&dt=t&q=" + encodeURIComponent(text);

  $httpClient.get(
    {
      url: url,
      headers: {
        "User-Agent": "Surge timedtext translator"
      },
      timeout: REQUEST_TIMEOUT
    },
    function (error, response, data) {
      if (error || !response || response.status >= 400 || !data) {
        callback("");
        return;
      }

      try {
        callback(parseGoogleTranslate(data));
      } catch (e) {
        callback("");
      }
    }
  );
}

function makeMarkedText(chunk) {
  return chunk.map(function (item) {
    return "@@YT" + item.index + "@@ " + item.text;
  }).join("\n");
}

function applyMarkedTranslations(translatedText, items) {
  let match;
  let count = 0;

  markerRegex.lastIndex = 0;

  while ((match = markerRegex.exec(translatedText)) !== null) {
    const index = Number(match[1]);
    const text = String(match[2] || "").trim();

    if (items[index] && text) {
      items[index].translated = text;
      count += 1;
    }
  }

  return count;
}

function buildChunks(items) {
  const chunks = [];
  let current = [];
  let currentText = "";

  for (let index = 0; index < items.length; index += 1) {
    if (!items[index].text) {
      continue;
    }

    const nextItem = {
      index: index,
      text: items[index].text
    };
    const nextText = currentText
      ? currentText + "\n" + makeMarkedText([nextItem])
      : makeMarkedText([nextItem]);

    if (
      current.length > 0 &&
      encodeURIComponent(nextText).length > MAX_URL_LENGTH
    ) {
      chunks.push(current);
      current = [nextItem];
      currentText = makeMarkedText([nextItem]);
    } else {
      current.push(nextItem);
      currentText = nextText;
    }

    if (chunks.length >= MAX_CHUNKS) {
      break;
    }
  }

  if (current.length > 0 && chunks.length < MAX_CHUNKS) {
    chunks.push(current);
  }

  return chunks;
}

const items = [];
let match;
const sourceLang = getRequestSourceLang();

if (!shouldTranslateSourceLang(sourceLang)) {
  console.log("YouTube timedtext skipped source lang: " + (sourceLang || "unknown"));
  $done({});
} else {

  while ((match = pRegex.exec(body)) !== null) {
    items.push({
      text: extractText(match[2]),
      translated: ""
    });
  }

  if (items.length === 0) {
    finish(items, 0);
  } else {
    const chunks = buildChunks(items);
    let chunkIndex = 0;
    let translatedCount = 0;

    function nextChunk() {
      if (chunkIndex >= chunks.length) {
        finish(items, translatedCount);
        return;
      }

      const chunk = chunks[chunkIndex];
      chunkIndex += 1;

      translateText(makeMarkedText(chunk), function (translatedText) {
        if (translatedText) {
          translatedCount += applyMarkedTranslations(translatedText, items);
        }

        nextChunk();
      });
    }

    nextChunk();
  }
}
