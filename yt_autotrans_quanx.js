/*
YT AutoTrans Error for Quantumult X

[rewrite_local]
^https://www\.youtube\.com/api/timedtext\?.*tlang= url script-request-header yt_autotrans_quanx.js
^https://www\.youtube\.com/api/timedtext\? url script-response-body yt_autotrans_quanx.js

[mitm]
hostname = www.youtube.com
*/

function qxNotify(subtitle, message) {
  if (typeof $notify === "function") {
    $notify("YT AutoTrans", subtitle, message || "");
  }
}

if (typeof $response === "undefined") {
  const META_TTL_MS_REQUEST = 10 * 60 * 1000;

  function qxHashString(text) {
    let hash = 2166136261;

    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return (hash >>> 0).toString(16);
  }

  function qxMetaKey(cleanUrl) {
    return "yt_tt_meta_" + qxHashString(cleanUrl);
  }

  try {
    const url = new URL($request.url);

    if (url.hostname !== "www.youtube.com" || url.pathname !== "/api/timedtext") {
      $done({});
    } else {
      const sourceLang = url.searchParams.get("lang") || "auto";
      const targetLang = url.searchParams.get("tlang");

      if (!targetLang) {
        $done({});
      } else {
        url.searchParams.delete("tlang");
        const cleanUrl = url.toString();

        if (typeof $prefs !== "undefined" && $prefs && $prefs.setValueForKey) {
          $prefs.setValueForKey(JSON.stringify({
            sourceLang: sourceLang,
            targetLang: targetLang,
            createdAt: Date.now(),
            expiresAt: Date.now() + META_TTL_MS_REQUEST
          }), qxMetaKey(cleanUrl));
        }

        qxNotify("request rewrite OK", sourceLang + " -> " + targetLang);
        $done({
          url: cleanUrl
        });
      }
    }
  } catch (error) {
    qxNotify("request error", String(error));
    $done({});
  }
} else {
const REQUEST_TIMEOUT = 10;
const MAX_URL_LENGTH = 5000;
const MAX_CHUNKS_PER_RESPONSE = 24;
const MAX_SEGMENT_WIDTH = 92;
const MAX_SEGMENT_WORDS = 16;
const MIN_SENTENCE_WIDTH = 24;
const SHORT_CONTEXT_WIDTH = 92;
const SHORT_CONTEXT_WORDS = 16;
const SHORT_TOKEN_LIMIT = 2;
const SHORT_DISPLAY_WIDTH = 14;
const SHORT_DURATION_MS = 1200;
const CACHE_VERSION = 7;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_OPTIONS = {
  showOnly: false,
  position: "Forward"
};

let body = $response.body || "";
let headers = Object.assign({}, $response.headers || {});

const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/g;
const sRegex = /<s\b([^>]*)>([\s\S]*?)<\/s>/g;
const attrRegex = /\s+([^\s=]+)="([^"]*)"/g;
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

  const mode = String(argument.mode || argument.Mode || "").toLowerCase();

  if (mode === "single" || mode === "mono" || mode === "translate" || mode === "translation-only") {
    options.showOnly = true;
  }

  if (mode === "reverse" || mode === "target-source" || mode === "zh-en") {
    options.position = "Reverse";
  }

  if (mode === "dual" || mode === "source-target" || mode === "en-zh") {
    options.showOnly = false;
    options.position = "Forward";
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
  let raw = null;

  if (typeof $prefs !== "undefined" && $prefs && $prefs.valueForKey) {
    raw = $prefs.valueForKey(key);
  } else if (typeof $persistentStore !== "undefined" && $persistentStore) {
    raw = $persistentStore.read(key);
  }

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
  const text = JSON.stringify(value);

  if (typeof $prefs !== "undefined" && $prefs && $prefs.setValueForKey) {
    $prefs.setValueForKey(text, key);
    return;
  }

  if (typeof $persistentStore !== "undefined" && $persistentStore) {
    $persistentStore.write(text, key);
  }
}

function getMeta() {
  const meta = readJson(metaKey($request.url));

  if (!meta || !meta.targetLang || !meta.expiresAt || Date.now() > meta.expiresAt) {
    try {
      const url = new URL($request.url);
      const targetLang = url.searchParams.get("tlang") || "zh-Hans";

      return {
        sourceLang: url.searchParams.get("lang") || "auto",
        targetLang: targetLang,
        createdAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS
      };
    } catch (e) {
      return {
        sourceLang: "auto",
        targetLang: "zh-Hans",
        createdAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS
      };
    }
  }

  return meta;
}

function getTranslationCache(key) {
  const cache = readJson(key);

  if (
    !cache ||
    cache.version !== CACHE_VERSION ||
    !cache.items ||
    !cache.expiresAt ||
    Date.now() > cache.expiresAt
  ) {
    return {
      version: CACHE_VERSION,
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

function encodeSubtitleText(text) {
  return String(text || "")
    .split("\n")
    .map(function (line) {
      return encodeXml(line);
    })
    .join("&#x000A;");
}

function extractText(content) {
  let text = "";
  let match;

  sRegex.lastIndex = 0;

  while ((match = sRegex.exec(content)) !== null) {
    text += decodeXml(match[2]);
  }

  if (text.trim()) {
    return text.trim();
  }

  return decodeXml(String(content || "").replace(/<[^>]+>/g, "")).trim();
}

function parseAttrs(attrs) {
  const values = {};
  let match;

  attrRegex.lastIndex = 0;

  while ((match = attrRegex.exec(attrs || "")) !== null) {
    values[match[1]] = match[2];
  }

  return values;
}

function buildAttrs(values) {
  let attrs = "";
  const keys = Object.keys(values || {});

  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    attrs += " " + key + "=\"" + encodeXml(values[key]) + "\"";
  }

  return attrs;
}

function mergeAttrs(attrs, values) {
  return buildAttrs(Object.assign({}, parseAttrs(attrs), values));
}

function normalizeTimedtextLayout(input) {
  let output = input;

  output = output.replace(/<ws\b([^>]*\bid="1"[^>]*)\/>/, function (match, attrs) {
    return "<ws" + mergeAttrs(attrs, {
      ju: "2"
    }) + "/>";
  });

  output = output.replace(/<wp\b([^>]*\bid="1"[^>]*)\/>/, function (match, attrs) {
    return "<wp" + mergeAttrs(attrs, {
      ap: "7",
      ah: "50",
      av: "100",
      rc: "2",
      cc: "80"
    }) + "/>";
  });

  output = output.replace(/<w\b([^>]*\bid="1"[^>]*)\/>/, function (match, attrs) {
    return "<w" + mergeAttrs(attrs, {
      wp: "1",
      ws: "1"
    }) + "/>";
  });

  return output;
}

function isAutomaticCaption(input, url) {
  return (
    /[?&]kind=asr(?:&|$)/.test(String(url || "")) ||
    /<w\b[^>]*\bwp="/.test(input) ||
    (/<p\b[^>]*\bw="1"/.test(input) && /<s\b[^>]*\bt="/.test(input))
  );
}

function extractSegments(content, duration) {
  const segments = [];
  let match;

  sRegex.lastIndex = 0;

  while ((match = sRegex.exec(content)) !== null) {
    const attrs = parseAttrs(match[1]);
    const start = Number(attrs.t || 0);
    const text = decodeXml(match[2]);

    if (text.trim()) {
      segments.push({
        start: isNaN(start) ? 0 : start,
        text: text
      });
    }
  }

  for (let index = 0; index < segments.length; index += 1) {
    const next = segments[index + 1];
    const end = next ? next.start : duration;
    segments[index].duration = Math.max(1, end - segments[index].start);
  }

  return segments;
}

function charWidth(char) {
  return /[^\x00-\xff]/.test(char) ? 2 : 1;
}

function displayWidth(text) {
  let width = 0;
  const value = String(text || "");

  for (let index = 0; index < value.length; index += 1) {
    width += charWidth(value.charAt(index));
  }

  return width;
}

function tokenCount(text) {
  const value = String(text || "").trim();

  if (!value) {
    return 0;
  }

  if (/\s/.test(value)) {
    return value.split(/\s+/).filter(Boolean).length;
  }

  return Math.ceil(displayWidth(value) / 2);
}

function endsSentence(text) {
  return /[.!?。！？;；:：]\s*$/.test(String(text || ""));
}

function shouldSplitSegment(currentText, nextText, tokenTotal, previousEndedSentence) {
  const text = currentText + nextText;

  return (
    currentText &&
    (
      displayWidth(text) > MAX_SEGMENT_WIDTH ||
      tokenTotal >= MAX_SEGMENT_WORDS ||
      (previousEndedSentence && displayWidth(currentText.trim()) >= MIN_SENTENCE_WIDTH)
    )
  );
}

function splitContent(attrs, content, paragraphIndex, shouldSplit) {
  const attrMap = parseAttrs(attrs);
  const duration = Number(attrMap.d || 0);
  const segments = extractSegments(content, duration);

  if (!shouldSplit || segments.length <= 1) {
    return [{
      paragraphIndex: paragraphIndex,
      paragraphIndexes: [paragraphIndex],
      attrs: attrs,
      text: extractText(content)
    }];
  }

  const items = [];
  let currentText = "";
  let currentStart = segments[0].start;
  let tokenTotal = 0;
  let previousEndedSentence = false;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const nextText = segment.text;

    if (shouldSplitSegment(currentText, nextText, tokenTotal, previousEndedSentence)) {
      const nextStart = segment.start;
      const nextAttrs = Object.assign({}, attrMap, {
        t: String(Number(attrMap.t || 0) + currentStart),
        d: String(Math.max(1, nextStart - currentStart))
      });

      items.push({
        paragraphIndex: paragraphIndex,
        paragraphIndexes: [paragraphIndex],
        attrs: buildAttrs(nextAttrs),
        text: currentText.trim()
      });

      currentText = "";
      currentStart = segment.start;
      tokenTotal = 0;
      previousEndedSentence = false;
    }

    currentText += nextText;
    tokenTotal += tokenCount(nextText);
    previousEndedSentence = endsSentence(nextText);
  }

  if (currentText.trim()) {
    const nextAttrs = Object.assign({}, attrMap, {
      t: String(Number(attrMap.t || 0) + currentStart),
      d: String(Math.max(1, duration - currentStart))
    });

    items.push({
      paragraphIndex: paragraphIndex,
      paragraphIndexes: [paragraphIndex],
      attrs: buildAttrs(nextAttrs),
      text: currentText.trim()
    });
  }

  return items.length ? items : [{
    paragraphIndex: paragraphIndex,
    paragraphIndexes: [paragraphIndex],
    attrs: attrs,
    text: extractText(content)
  }];
}

function isSpacerParagraph(attrs, content) {
  const attrMap = parseAttrs(attrs);
  return attrMap.a === "1" && !extractText(content);
}

function clampOverlappingDurations(items) {
  for (let index = 0; index < items.length - 1; index += 1) {
    const attrs = parseAttrs(items[index].attrs);
    const nextAttrs = parseAttrs(items[index + 1].attrs);
    const start = Number(attrs.t);
    const duration = Number(attrs.d);
    const nextStart = Number(nextAttrs.t);

    if (
      !isNaN(start) &&
      !isNaN(duration) &&
      !isNaN(nextStart) &&
      nextStart > start &&
      start + duration > nextStart
    ) {
      attrs.d = String(Math.max(1, nextStart - start));
      items[index].attrs = buildAttrs(attrs);
    }
  }
}

function itemNumberAttr(item, key) {
  const attrs = parseAttrs(item.attrs);
  return Number(attrs[key] || 0);
}

function itemDuration(item) {
  return itemNumberAttr(item, "d");
}

function joinSubtitleText(left, right) {
  return (String(left || "") + " " + String(right || "")).replace(/\s+/g, " ").trim();
}

function isBracketCue(text) {
  return /^\s*\[[^\]]+\]\s*$/.test(String(text || ""));
}

function isShortCue(item) {
  return (
    item &&
    item.text &&
    !isBracketCue(item.text) &&
    (
      tokenCount(item.text) <= SHORT_TOKEN_LIMIT ||
      displayWidth(item.text) <= SHORT_DISPLAY_WIDTH ||
      itemDuration(item) <= SHORT_DURATION_MS
    )
  );
}

function canUseContext(text) {
  return (
    text &&
    displayWidth(text) <= SHORT_CONTEXT_WIDTH &&
    tokenCount(text) <= SHORT_CONTEXT_WORDS
  );
}

function addShortCueContext(items) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (!isShortCue(item)) {
      continue;
    }

    const previous = items[index - 1];
    const next = items[index + 1];
    const previousText = previous && previous.text ? joinSubtitleText(previous.text, item.text) : "";
    const nextText = next && next.text ? joinSubtitleText(item.text, next.text) : "";

    if (previousText && !endsSentence(previous.text) && canUseContext(previousText)) {
      item.text = previousText;
    } else if (nextText && !endsSentence(item.text) && canUseContext(nextText)) {
      item.text = nextText;
    }
  }
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

  const request = {
    url: url,
    headers: {
      "User-Agent": "Quantumult X timedtext translator"
    },
    timeout: REQUEST_TIMEOUT
  };

  if (typeof $task !== "undefined" && $task && $task.fetch) {
    $task.fetch(request).then(
      function (response) {
        const status = response.statusCode || response.status || 0;

        if (status >= 400 || !response.body) {
          callback("");
          return;
        }

        try {
          callback(parseGoogleTranslate(response.body));
        } catch (e) {
          callback("");
        }
      },
      function () {
        callback("");
      }
    );
    return;
  }

  $httpClient.get(
    {
      url: url,
      headers: {
        "User-Agent": "Quantumult X timedtext translator"
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

function finish(items, translatedCount, cache, key, options, useAsrLayout) {
  let index = 0;
  const replacements = {};

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];

    if (!item.translated) {
      continue;
    }

    const text = makeSubtitleText(item.text, item.translated, options);
    const xml = "<p" + item.attrs + "><s ac=\"0\">" + encodeSubtitleText(text) + "</s></p>";

    if (!replacements[item.paragraphIndex]) {
      replacements[item.paragraphIndex] = "";
    }

    replacements[item.paragraphIndex] += xml;
  }

  body = body.replace(pRegex, function (match, attrs, content) {
    const replacement = replacements[index];
    index += 1;

    if (useAsrLayout && !replacement && isSpacerParagraph(attrs, content)) {
      return "";
    }

    return replacement || match;
  });

  writeJson(key, cache);
  normalizeHeaders();

  console.log("YouTube timedtext translated: " + translatedCount + "/" + items.length);
  qxNotify("response OK", translatedCount + "/" + items.length + " translated");

  $done({
    body: body,
    headers: headers
  });
}

function extractJson3Text(event) {
  if (!event || !Array.isArray(event.segs)) {
    return "";
  }

  return event.segs.map(function (seg) {
    return seg && seg.utf8 ? seg.utf8 : "";
  }).join("").trim();
}

function setJson3Text(event, text) {
  event.segs = [{
    utf8: text
  }];
}

function tryHandleJson3(meta, cache, key, options) {
  let json;

  try {
    json = JSON.parse(body);
  } catch (e) {
    return false;
  }

  if (!json || !Array.isArray(json.events)) {
    return false;
  }

  const items = [];

  for (let index = 0; index < json.events.length; index += 1) {
    const event = json.events[index];
    const text = extractJson3Text(event);

    if (text) {
      items.push({
        index: index,
        event: event,
        text: text,
        translated: cache.items[String(index)] || ""
      });
    }
  }

  if (items.length === 0) {
    writeJson(key, cache);
    qxNotify("json3 skip", "0 events");
    $done({});
    return true;
  }

  const pending = items.filter(function (item) {
    return !item.translated;
  }).slice(0, MAX_CHUNKS_PER_RESPONSE);
  let finished = 0;
  let translatedCount = 0;

  function finishJson3() {
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];

      if (item.translated) {
        setJson3Text(item.event, makeSubtitleText(item.text, item.translated, options));
      }
    }

    writeJson(key, cache);
    normalizeHeaders();
    headers["Content-Type"] = "application/json; charset=UTF-8";

    console.log("YouTube timedtext json3 translated: " + translatedCount + "/" + items.length);
    qxNotify("json3 OK", translatedCount + "/" + items.length + " translated");

    $done({
      body: JSON.stringify(json),
      headers: headers
    });
  }

  if (pending.length === 0) {
    finishJson3();
    return true;
  }

  for (let index = 0; index < pending.length; index += 1) {
    (function (item) {
      translateText(item.text, meta.sourceLang || "auto", meta.targetLang, function (translatedText) {
        if (translatedText) {
          item.translated = translatedText.trim();
          cache.items[String(item.index)] = item.translated;
          translatedCount += 1;
        }

        finished += 1;

        if (finished >= pending.length) {
          finishJson3();
        }
      });
    })(pending[index]);
  }

  return true;
}

const options = parseArguments();
const meta = getMeta();

if (!meta) {
  console.log("YouTube timedtext skipped: no target language metadata");
  qxNotify("response skip", "no target language metadata");
  $done({});
} else if (
  meta.sourceLang &&
  meta.targetLang &&
  meta.sourceLang.split(/[-_]/)[0].toLowerCase() ===
    meta.targetLang.split(/[-_]/)[0].toLowerCase()
) {
  console.log("YouTube timedtext skipped same language: " + meta.sourceLang);
  qxNotify("response skip", "same language " + meta.sourceLang);
  $done({});
} else {
  const key = cacheKey($request.url, meta.targetLang);
  const cache = getTranslationCache(key);

  if (tryHandleJson3(meta, cache, key, options)) {
    // JSON3 subtitles were handled asynchronously.
  } else {
  let items = [];
  const useAsrLayout = isAutomaticCaption(body, $request.url);
  let match;
  let paragraphIndex = 0;

  if (useAsrLayout) {
    body = normalizeTimedtextLayout(body);
  }

  while ((match = pRegex.exec(body)) !== null) {
    if (useAsrLayout && isSpacerParagraph(match[1], match[2])) {
      paragraphIndex += 1;
      continue;
    }

    const splitItems = splitContent(match[1], match[2], paragraphIndex, useAsrLayout);
    paragraphIndex += 1;

    for (let splitIndex = 0; splitIndex < splitItems.length; splitIndex += 1) {
      items.push(splitItems[splitIndex]);
    }
  }

  if (useAsrLayout) {
    addShortCueContext(items);
    clampOverlappingDurations(items);
  }

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    items[itemIndex].translated = items[itemIndex].text ? cache.items[String(itemIndex)] || "" : "";
  }

  if (items.length === 0) {
    finish(items, 0, cache, key, options, useAsrLayout);
  } else {
    const chunks = buildChunks(items);
    let chunkIndex = 0;
    let translatedCount = 0;

    function nextChunk() {
      if (chunkIndex >= chunks.length) {
        finish(items, translatedCount, cache, key, options, useAsrLayout);
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
}
}
