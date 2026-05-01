const REQUEST_TIMEOUT = 5;
const MAX_URL_LENGTH = 5000;
const MAX_CHUNKS_PER_RESPONSE = 8;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_OPTIONS = {
  showOnly: false,
  position: "Forward"
};

let body = $response.body || "";
let headers = Object.assign({}, $response.headers || {});

const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/g;
const sRegex = /<s\b[^>]*>([\s\S]*?)<\/s>/g;
const markerRegex = /@@YT(\d+)@@([\s\S]*?)(?=@@YT\d+@@|$)/g;

function hashString(text) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(16);
}

function metaKey(cleanUrl) {
  return "yt_tt_meta_" + hashString(cleanUrl);
}

function cacheKey(cleanUrl, targetLang) {
  return "yt_tt_cache_" + hashString(cleanUrl + "|" + targetLang);
}

function parseArguments() {
  const options = Object.assign({}, DEFAULT_OPTIONS);
  let argument = {};

  if (typeof $argument === "string" && $argument) {
    const pairs = $argument.split("&");

    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[index].split("=");
      const key = decodeURIComponent(pair[0] || "");
      const value = decodeURIComponent(pair.slice(1).join("=") || "");

      if (key) {
        argument[key] = value;
      }
    }
  } else if (typeof $argument === "object" && $argument) {
    argument = $argument;
  }

  if (
    argument.show_only === true ||
    argument.show_only === "true" ||
    argument.show_only === "1" ||
    argument.show_only === "yes" ||
    argument.ShowOnly === true ||
    argument.ShowOnly === "true" ||
    argument.ShowOnly === "1" ||
    argument.ShowOnly === "yes"
  ) {
    options.showOnly = true;
  }

  if (
    argument.bilingual === false ||
    argument.bilingual === "false" ||
    argument.bilingual === "0" ||
    argument.bilingual === "no"
  ) {
    options.showOnly = true;
  }

  if (String(argument.position || argument.Position || "") === "Reverse") {
    options.position = "Reverse";
  }

  if (String(argument.order || "") === "target-source") {
    options.position = "Reverse";
  }

  return options;
}

function readJson(key) {
  const raw = $persistentStore.read(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeJson(key, value) {
  $persistentStore.write(JSON.stringify(value), key);
}

function getMeta() {
  const meta = readJson(metaKey($request.url));

  if (!meta || !meta.targetLang || !meta.expiresAt || Date.now() > meta.expiresAt) {
    return null;
  }

  return meta;
}

function getTranslationCache(key) {
  const cache = readJson(key);

  if (!cache || !cache.items || !cache.expiresAt || Date.now() > cache.expiresAt) {
    return {
      version: 1,
      createdAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS,
      items: {}
    };
  }

  cache.expiresAt = Date.now() + CACHE_TTL_MS;
  return cache;
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

function makeSubtitleText(sourceText, translatedText, options) {
  if (options.showOnly) {
    return translatedText;
  }

  if (options.position === "Reverse") {
    return translatedText + "\n" + sourceText;
  }

  return sourceText + "\n" + translatedText;
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

function translateText(text, sourceLang, targetLang, callback) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx" +
    "&sl=" + encodeURIComponent(sourceLang || "auto") +
    "&tl=" + encodeURIComponent(targetLang) +
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

function applyMarkedTranslations(translatedText, items, cache) {
  let match;
  let count = 0;

  markerRegex.lastIndex = 0;

  while ((match = markerRegex.exec(translatedText)) !== null) {
    const index = Number(match[1]);
    const text = String(match[2] || "").trim();

    if (items[index] && text) {
      items[index].translated = text;
      cache.items[String(index)] = text;
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
    if (!items[index].text || items[index].translated) {
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

    if (chunks.length >= MAX_CHUNKS_PER_RESPONSE) {
      break;
    }
  }

  if (current.length > 0 && chunks.length < MAX_CHUNKS_PER_RESPONSE) {
    chunks.push(current);
  }

  return chunks;
}

function finish(items, translatedCount, cache, key, options) {
  let index = 0;

  body = body.replace(pRegex, function (match, attrs, content) {
    const item = items[index];
    index += 1;

    if (!item || !item.translated) {
      return match;
    }

    const text = makeSubtitleText(item.text, item.translated, options);
    return "<p" + attrs + "><s ac=\"0\">" + encodeXml(text) + "</s></p>";
  });

  writeJson(key, cache);
  normalizeHeaders();

  console.log("YouTube timedtext translated: " + translatedCount + "/" + items.length);

  $done({
    body: body,
    headers: headers
  });
}

const options = parseArguments();
const meta = getMeta();

if (!meta) {
  console.log("YouTube timedtext skipped: no target language metadata");
  $done({});
} else if (
  meta.sourceLang &&
  meta.targetLang &&
  meta.sourceLang.split(/[-_]/)[0].toLowerCase() ===
    meta.targetLang.split(/[-_]/)[0].toLowerCase()
) {
  console.log("YouTube timedtext skipped same language: " + meta.sourceLang);
  $done({});
} else {
  const key = cacheKey($request.url, meta.targetLang);
  const cache = getTranslationCache(key);
  const items = [];
  let match;

  while ((match = pRegex.exec(body)) !== null) {
    const index = items.length;
    const cachedText = cache.items[String(index)] || "";

    items.push({
      text: extractText(match[2]),
      translated: cachedText
    });
  }

  if (items.length === 0) {
    finish(items, 0, cache, key, options);
  } else {
    const chunks = buildChunks(items);
    let chunkIndex = 0;
    let translatedCount = 0;

    function nextChunk() {
      if (chunkIndex >= chunks.length) {
        finish(items, translatedCount, cache, key, options);
        return;
      }

      const chunk = chunks[chunkIndex];
      chunkIndex += 1;

      translateText(
        makeMarkedText(chunk),
        meta.sourceLang || "auto",
        meta.targetLang,
        function (translatedText) {
          if (translatedText) {
            translatedCount += applyMarkedTranslations(translatedText, items, cache);
          }

          nextChunk();
        }
      );
    }

    nextChunk();
  }
}
