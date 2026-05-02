const REQUEST_TIMEOUT = 4;
const RESPONSE_DEADLINE_MS = 7500;
const LONG_TRACK_DEADLINE_MS = 7000;
const MAX_TRANSLATE_GET_LENGTH = 5000;
const MAX_TRANSLATE_BODY_LENGTH = 12000;
const MAX_LONG_TRACK_TRANSLATE_BODY_LENGTH = 16000;
const MAX_CHUNKS_PER_RESPONSE = 24;
const MAX_LONG_TRACK_CHUNKS = 24;
const MAX_PARALLEL_REQUESTS = 4;
const MAX_LONG_TRACK_PARALLEL_REQUESTS = 4;
const MAX_GET_FALLBACK_PARTS = 8;
const MAX_GET_FALLBACK_PARALLEL_REQUESTS = 2;
const MAX_SELF_RELOADS = 3;
const RELOAD_TTL_MS = 60 * 1000;
const LONG_TRACK_BODY_LENGTH = 240000;
const LONG_TRACK_ITEM_COUNT = 900;
const MAX_SEGMENT_WIDTH = 92;
const MAX_SEGMENT_WORDS = 16;
const MIN_SENTENCE_WIDTH = 24;
const SHORT_CONTEXT_WIDTH = 92;
const SHORT_CONTEXT_WORDS = 16;
const SHORT_TOKEN_LIMIT = 2;
const SHORT_DISPLAY_WIDTH = 14;
const SHORT_DURATION_MS = 1200;
const CACHE_VERSION = 20;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_OPTIONS = {
  showOnly: false,
  position: "Forward",
  debugNoMeta: false,
  debugTranslateFailure: true
};
const TRANSLATE_TIMEOUT_TEXT = "[YT AutoTrans] Google 翻译服务超时，请检查节点或稍后重试。";
const NO_META_TEXT = "[YT AutoTrans] skipped=no-meta\n响应脚本已命中，但没有找到 tlang 元数据。\n请检查本次请求前是否有 youtube-timedtext-request 302。";
const TRANSLATE_FAILED_TEXT = "[YT AutoTrans] translate failed\n已拿到 tlang 元数据，但 POST 和 fallback GET 没有拿到有效译文。\n请检查 translate.googleapis.com 请求是否 timeout / 429 / blocked。";

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

function reloadKey(cleanUrl, targetLang) {
  return "yt_tt_reload_" + hashString(cleanUrl + "|" + targetLang);
}

function canonicalTimedtextUrl(urlString) {
  try {
    const url = new URL(urlString);
    const pairs = [];

    url.searchParams.forEach(function (value, key) {
      pairs.push([key, value]);
    });

    pairs.sort(function (left, right) {
      if (left[0] === right[0]) {
        return left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0;
      }

      return left[0] < right[0] ? -1 : 1;
    });

    return url.origin + url.pathname + "?" + pairs.map(function (pair) {
      return encodeURIComponent(pair[0]) + "=" + encodeURIComponent(pair[1]);
    }).join("&");
  } catch (error) {
    return urlString;
  }
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
  const debug = String(argument.debug || argument.Debug || "translate").toLowerCase();

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

  if (debug === "all" || debug === "on" || debug === "true" || debug === "1") {
    options.debugNoMeta = true;
    options.debugTranslateFailure = true;
  } else if (debug === "no-meta" || debug === "nometa") {
    options.debugNoMeta = true;
    options.debugTranslateFailure = false;
  } else if (debug === "off" || debug === "false" || debug === "0") {
    options.debugNoMeta = false;
    options.debugTranslateFailure = false;
  } else {
    options.debugNoMeta = false;
    options.debugTranslateFailure = true;
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

function clearStoreKey(key) {
  if (key) {
    $persistentStore.write("", key);
  }
}

function getMetaState() {
  const exactKey = metaKey($request.url);
  const canonicalKey = metaKey(canonicalTimedtextUrl($request.url));
  const exactMeta = readJson(exactKey);
  const canonicalMeta = exactKey === canonicalKey ? null : readJson(canonicalKey);
  const meta = exactMeta || canonicalMeta;

  if (!meta || !meta.targetLang || !meta.expiresAt || Date.now() > meta.expiresAt) {
    return null;
  }

  return {
    meta: meta,
    keys: exactKey === canonicalKey ? [exactKey] : [exactKey, canonicalKey]
  };
}

function consumeMeta(metaState) {
  if (!metaState || !metaState.keys) {
    return;
  }

  for (let index = 0; index < metaState.keys.length; index += 1) {
    clearStoreKey(metaState.keys[index]);
  }
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

function getReloadCount(key) {
  const state = readJson(key);

  if (!state || !state.expiresAt || Date.now() > state.expiresAt) {
    return 0;
  }

  return Number(state.count || 0);
}

function setReloadCount(key, count) {
  writeJson(key, {
    count: count,
    expiresAt: Date.now() + RELOAD_TTL_MS
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

function cleanSpeakerMarkers(text) {
  return String(text || "")
    .split("\n")
    .map(function (line) {
      return line.replace(/^\s*(?:(?:>>|<<|＞＞|＜＜|》》|《《)\s*)+/, "");
    })
    .join("\n")
    .trim();
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
    return cleanSpeakerMarkers(text.trim());
  }

  return cleanSpeakerMarkers(decodeXml(String(content || "").replace(/<[^>]+>/g, "")).trim());
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
  sourceText = cleanSpeakerMarkers(sourceText);
  translatedText = cleanSpeakerMarkers(translatedText);

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

function isChunkedResponse() {
  const value = headers["Transfer-Encoding"] || headers["transfer-encoding"] || "";
  return String(value).toLowerCase().indexOf("chunked") !== -1;
}

function makePlan(items, input) {
  const longTrack =
    String(input || "").length >= LONG_TRACK_BODY_LENGTH ||
    items.length >= LONG_TRACK_ITEM_COUNT ||
    isChunkedResponse();

  if (!longTrack) {
    return {
      longTrack: false,
      deadlineMs: RESPONSE_DEADLINE_MS,
      maxChunks: MAX_CHUNKS_PER_RESPONSE,
      maxParallelRequests: MAX_PARALLEL_REQUESTS,
      maxTranslateBodyLength: MAX_TRANSLATE_BODY_LENGTH,
      allowSelfReload: true
    };
  }

  return {
    longTrack: true,
    deadlineMs: LONG_TRACK_DEADLINE_MS,
    maxChunks: MAX_LONG_TRACK_CHUNKS,
    maxParallelRequests: MAX_LONG_TRACK_PARALLEL_REQUESTS,
    maxTranslateBodyLength: MAX_LONG_TRACK_TRANSLATE_BODY_LENGTH,
    allowSelfReload: false
  };
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

function handleTranslateResponse(error, response, data, callback) {
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

function splitMarkedTextForGet(text) {
  const parts = [];
  const lines = String(text || "").split("\n");
  let current = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = current ? current + "\n" + line : line;

    if (current && encodeURIComponent(next).length > MAX_TRANSLATE_GET_LENGTH) {
      parts.push(current);
      current = line;
    } else {
      current = next;
    }

    if (parts.length >= MAX_GET_FALLBACK_PARTS) {
      break;
    }
  }

  if (current && parts.length < MAX_GET_FALLBACK_PARTS) {
    parts.push(current);
  }

  return parts;
}

function translateTextByGet(text, sourceLang, targetLang, callback) {
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
      handleTranslateResponse(error, response, data, callback);
    }
  );
}

function translateMarkedTextByGetFallback(text, sourceLang, targetLang, callback) {
  const parts = splitMarkedTextForGet(text);
  const results = [];
  let nextIndex = 0;
  let activeCount = 0;
  let completedCount = 0;
  let successCount = 0;
  let finished = false;

  function completeIfDone() {
    if (finished || completedCount < parts.length) {
      return;
    }

    finished = true;
    callback(successCount > 0 ? results.filter(Boolean).join("\n") : "");
  }

  function startNext() {
    while (
      !finished &&
      activeCount < MAX_GET_FALLBACK_PARALLEL_REQUESTS &&
      nextIndex < parts.length
    ) {
      const partIndex = nextIndex;
      const part = parts[partIndex];
      nextIndex += 1;
      activeCount += 1;

      translateTextByGet(part, sourceLang, targetLang, function (translatedText) {
        activeCount -= 1;
        completedCount += 1;

        if (translatedText) {
          results[partIndex] = translatedText;
          successCount += 1;
        } else {
          results[partIndex] = "";
        }

        if (completedCount >= parts.length) {
          completeIfDone();
        } else {
          startNext();
        }
      });
    }
  }

  if (parts.length === 0) {
    callback("");
    return;
  }

  startNext();
}

function translateTextByPost(text, sourceLang, targetLang, callback) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx" +
    "&sl=" + encodeURIComponent(sourceLang || "auto") +
    "&tl=" + encodeURIComponent(targetLang) +
    "&dt=t";

  $httpClient.post(
    {
      url: url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Surge timedtext translator"
      },
      body: "q=" + encodeURIComponent(text),
      timeout: REQUEST_TIMEOUT
    },
    function (error, response, data) {
      handleTranslateResponse(error, response, data, callback);
    }
  );
}

function translateText(text, sourceLang, targetLang, callback) {
  translateTextByPost(text, sourceLang, targetLang, function (translatedText) {
    if (translatedText) {
      callback(translatedText);
      return;
    }

    if (encodeURIComponent(text).length <= MAX_TRANSLATE_GET_LENGTH) {
      translateTextByGet(text, sourceLang, targetLang, callback);
      return;
    }

    translateMarkedTextByGetFallback(text, sourceLang, targetLang, callback);
  });
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
    const text = cleanSpeakerMarkers(String(match[2] || "").trim());

    if (items[index] && text) {
      items[index].translated = text;
      cache.items[String(index)] = text;
      count += 1;
    }
  }

  return count;
}

function buildChunks(items, maxChunks, maxTranslateBodyLength) {
  const chunks = [];
  let current = [];
  let currentText = "";
  const limit = maxChunks || MAX_CHUNKS_PER_RESPONSE;
  const textLimit = maxTranslateBodyLength || MAX_TRANSLATE_BODY_LENGTH;

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
      encodeURIComponent(nextText).length > textLimit
    ) {
      chunks.push(current);
      current = [nextItem];
      currentText = makeMarkedText([nextItem]);
    } else {
      current.push(nextItem);
      currentText = nextText;
    }

    if (chunks.length >= limit) {
      break;
    }
  }

  if (current.length > 0 && chunks.length < limit) {
    chunks.push(current);
  }

  return chunks;
}

function markTranslateTimeoutTrack(items) {
  let count = 0;

  for (let index = 0; index < items.length; index += 1) {
    if (items[index].text) {
      items[index].translated = TRANSLATE_TIMEOUT_TEXT;
      items[index].diagnostic = true;
      count += 1;
    }
  }

  return count;
}

function markDiagnosticTrack(items, text) {
  let count = 0;

  for (let index = 0; index < items.length; index += 1) {
    if (items[index].text) {
      items[index].translated = text;
      items[index].diagnostic = true;
      count += 1;
    }
  }

  return count;
}

function countUntranslatedItems(items) {
  let count = 0;

  for (let index = 0; index < items.length; index += 1) {
    if (items[index].text && (!items[index].translated || items[index].diagnostic)) {
      count += 1;
    }
  }

  return count;
}

function countCachedItems(items) {
  let count = 0;

  for (let index = 0; index < items.length; index += 1) {
    if (items[index].text && items[index].translated && !items[index].diagnostic) {
      count += 1;
    }
  }

  return count;
}

function shouldSelfReload(items, translatedCount, reloadStateKey, allowSelfReload) {
  return (
    allowSelfReload !== false &&
    translatedCount > 0 &&
    countUntranslatedItems(items) > 0 &&
    getReloadCount(reloadStateKey) < MAX_SELF_RELOADS
  );
}

function selfReload(cache, cacheStateKey, reloadStateKey) {
  const count = getReloadCount(reloadStateKey);

  writeJson(cacheStateKey, cache);
  setReloadCount(reloadStateKey, count + 1);

  console.log("YouTube timedtext self reload: " + (count + 1) + "/" + MAX_SELF_RELOADS);

  $done({
    response: {
      status: 302,
      headers: {
        Location: canonicalTimedtextUrl($request.url),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Content-Type": "text/plain; charset=UTF-8",
        "X-YT-AutoTrans": "self-reload"
      },
      body: ""
    }
  });
}

function finish(items, translatedCount, cache, key, reloadStateKey, options, useAsrLayout, status, stats) {
  let index = 0;
  const replacements = {};

  if (shouldSelfReload(items, translatedCount, reloadStateKey, !stats || stats.allowSelfReload !== false)) {
    selfReload(cache, key, reloadStateKey);
    return;
  }

  setReloadCount(reloadStateKey, 0);

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];

    if (!item.translated) {
      continue;
    }

    const text = item.diagnostic
      ? item.translated
      : makeSubtitleText(item.text, item.translated, options);
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
  if (stats && stats.metaState) {
    consumeMeta(stats.metaState);
  }

  normalizeHeaders();
  headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
  headers.Pragma = "no-cache";
  headers.Expires = "0";
  headers["X-YT-AutoTrans"] =
    "items=" +
    items.length +
    (stats && stats.longTrack ? ";long=1" : "") +
    ";cached=" +
    countCachedItems(items) +
    ";requested=" +
    (stats ? stats.requested : 0) +
    ";ok=" +
    translatedCount +
    ";fail=" +
    (stats ? stats.failed : 0) +
    ";missing=" +
    countUntranslatedItems(items) +
    (stats && stats.deadlineMs ? ";budget=" + stats.deadlineMs + "ms" : "") +
    (status ? ";status=" + status : "");

  console.log(
    "YouTube timedtext translated: " +
      translatedCount +
      "/" +
      items.length +
      (status ? " (" + status + ")" : "")
  );

  $done({
    body: body,
    headers: headers
  });
}

function finishDiagnostic(status, text) {
  let count = 0;
  let replaced = false;

  if (isAutomaticCaption(body, $request.url)) {
    body = normalizeTimedtextLayout(body);
  }

  body = body.replace(pRegex, function (match, attrs, content) {
    if (isSpacerParagraph(attrs, content)) {
      return match;
    }

    replaced = true;
    count += 1;
    return "<p" + attrs + "><s ac=\"0\">" + encodeSubtitleText(text) + "</s></p>";
  });

  if (!replaced) {
    body = body.replace(
      /<\/body>/,
      "<p t=\"0\" d=\"4000\"><s ac=\"0\">" + encodeSubtitleText(text) + "</s></p></body>"
    );
  }

  normalizeHeaders();
  headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
  headers.Pragma = "no-cache";
  headers.Expires = "0";
  headers["X-YT-AutoTrans"] = status + ";diagnostic=all-cues;diagnosticItems=" + count;

  $done({
    body: body,
    headers: headers
  });
}

const options = parseArguments();
const metaState = getMetaState();
const meta = metaState ? metaState.meta : null;

if (!meta) {
  console.log("YouTube timedtext skipped: no target language metadata");
  if (options.debugNoMeta) {
    finishDiagnostic("skipped=no-meta", NO_META_TEXT);
  } else {
    headers["X-YT-AutoTrans"] = "skipped=no-meta;diagnostic=off";
    $done({
      headers: headers
    });
  }
} else if (
  meta.sourceLang &&
  meta.targetLang &&
  meta.sourceLang.split(/[-_]/)[0].toLowerCase() ===
    meta.targetLang.split(/[-_]/)[0].toLowerCase()
) {
  console.log("YouTube timedtext skipped same language: " + meta.sourceLang);
  consumeMeta(metaState);
  headers["X-YT-AutoTrans"] = "skipped=same-language";
  $done({
    headers: headers
  });
} else {
  const stateUrl = canonicalTimedtextUrl(meta.cleanUrl || $request.url);
  const key = cacheKey(stateUrl, meta.targetLang);
  const reloadStateKey = reloadKey(stateUrl, meta.targetLang);
  const cache = getTranslationCache(key);
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

  const plan = makePlan(items, body);

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    items[itemIndex].translated = items[itemIndex].text ? cache.items[String(itemIndex)] || "" : "";
  }

  if (items.length === 0) {
    finish(items, 0, cache, key, reloadStateKey, options, useAsrLayout, "", {
      requested: 0,
      failed: 0,
      longTrack: plan.longTrack,
      deadlineMs: plan.deadlineMs,
      allowSelfReload: plan.allowSelfReload,
      metaState: metaState
    });
  } else {
    const chunks = buildChunks(items, plan.maxChunks, plan.maxTranslateBodyLength);
    let completedCount = 0;
    let translatedCount = 0;
    let failedCount = 0;
    const startedAt = Date.now();
    let nextChunkIndex = 0;
    let activeCount = 0;
    let finished = false;

    function complete(status) {
      if (finished) {
        return;
      }

      finished = true;

      if (translatedCount === 0 && status) {
        if (plan.longTrack) {
          if (options.debugTranslateFailure) {
            markDiagnosticTrack(items, TRANSLATE_FAILED_TEXT);
            status = status + ";diagnostic=all-cues";
          } else {
            status = status + ";fast-return";
          }
        } else {
          markTranslateTimeoutTrack(items);
        }
      }

      finish(items, translatedCount, cache, key, reloadStateKey, options, useAsrLayout, status, {
        requested: completedCount,
        failed: failedCount,
        longTrack: plan.longTrack,
        deadlineMs: plan.deadlineMs,
        allowSelfReload: plan.allowSelfReload,
        metaState: metaState
      });
    }

    function completeOne(translatedText) {
      if (finished) {
        return;
      }

      if (translatedText) {
        translatedCount += applyMarkedTranslations(translatedText, items, cache);
      } else {
        failedCount += 1;
      }

      completedCount += 1;

      if (completedCount >= chunks.length) {
        complete(translatedCount === 0 && failedCount > 0 ? "translate failed" : "");
      } else {
        startNextChunks();
      }
    }

    function startNextChunks() {
      while (
        !finished &&
        activeCount < plan.maxParallelRequests &&
        nextChunkIndex < chunks.length &&
        Date.now() - startedAt < plan.deadlineMs
      ) {
        const chunk = chunks[nextChunkIndex];
        nextChunkIndex += 1;
        activeCount += 1;

        translateText(
          makeMarkedText(chunk),
          meta.sourceLang || "auto",
          meta.targetLang,
          function (translatedText) {
            activeCount -= 1;
            completeOne(translatedText);
          }
        );
      }
    }

    if (chunks.length === 0) {
      finish(items, translatedCount, cache, key, reloadStateKey, options, useAsrLayout, "", {
        requested: 0,
        failed: 0,
        longTrack: plan.longTrack,
        deadlineMs: plan.deadlineMs,
        allowSelfReload: plan.allowSelfReload,
        metaState: metaState
      });
    } else {
      setTimeout(function () {
        complete("translate timeout");
      }, plan.deadlineMs);

      startNextChunks();
    }
  }
}
