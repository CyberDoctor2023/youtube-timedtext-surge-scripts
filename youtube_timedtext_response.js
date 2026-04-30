const url = $request.url;
let body = $response.body || "";

const TARGET_LANG = "zh-CN"; // 先固定简体中文，跑通后再做繁中/其他语言
const BATCH_SIZE = 5;
const SPLIT_MARK = "\n<<<YT_SPLIT_SAFE_2026>>>\n";

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

function byteLength(str) {
  return unescape(encodeURIComponent(String(str || ""))).length;
}

function makeHeaders(headers, responseBody, debug) {
  let h = {};
  for (let k in headers) h[k] = headers[k];

  delete h["Content-Length"];
  delete h["content-length"];
  delete h["Transfer-Encoding"];
  delete h["transfer-encoding"];
  delete h["Content-Encoding"];
  delete h["content-encoding"];

  h["Content-Type"] = "text/xml; charset=UTF-8";
  h["Content-Encoding"] = "identity";
  h["Cache-Control"] = "no-cache";
  h["Pragma"] = "no-cache";
  h["Expires"] = "Fri, 01 Jan 1990 00:00:00 GMT";
  h["Content-Length"] = String(byteLength(responseBody));
  h["X-YT-Debug"] = debug || "NO_DEBUG";

  return h;
}

function isTimedText(xml) {
  return /<timedtext\b/.test(xml) && /<p\b[^>]*>[\s\S]*?<\/p>/.test(xml);
}

function makeMessageBody(message) {
  return (
    '<?xml version="1.0" encoding="utf-8" ?>' +
    '<timedtext format="3">' +
    '<body>' +
    '<p t="0" d="6000">' + encodeXml(message) + '</p>' +
    '</body>' +
    '</timedtext>'
  );
}

function extractText(content) {
  content = String(content || "");

  // 兼容 Gemini / ASR 的逐词结构：<p><s>word</s><s>word</s></p>
  if (/<s\b[^>]*>[\s\S]*?<\/s>/.test(content)) {
    let words = [];

    content.replace(/<s\b[^>]*>([\s\S]*?)<\/s>/g, function (_, word) {
      words.push(decodeXml(word));
      return _;
    });

    return words.join(" ").replace(/\s+/g, " ").trim();
  }

  // 普通结构：<p t="..." d="...">text</p>
  return decodeXml(content)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function googleTranslateOne(text, targetLang, callback) {
  if (!text) {
    callback("【空字幕】");
    return;
  }

  const api =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx" +
    "&sl=auto" +
    "&tl=" + encodeURIComponent(targetLang) +
    "&dt=t" +
    "&q=" + encodeURIComponent(text);

  $httpClient.get(api, function (error, response, data) {
    if (error || !data) {
      callback("【翻译失败：Google 单条请求失败】");
      return;
    }

    try {
      const json = JSON.parse(data);

      if (!json || !json[0]) {
        callback("【翻译失败：Google 单条返回为空】");
        return;
      }

      const translated = json[0].map(function (x) {
        return x[0];
      }).join("").trim();

      callback(translated || "【翻译失败：单条空结果】");
    } catch (e) {
      callback("【翻译失败：Google 单条解析失败】");
    }
  });
}

function googleTranslateBatch(texts, targetLang, callback) {
  const joined = texts.join(SPLIT_MARK);

  const api =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx" +
    "&sl=auto" +
    "&tl=" + encodeURIComponent(targetLang) +
    "&dt=t" +
    "&q=" + encodeURIComponent(joined);

  $httpClient.get(api, function (error, response, data) {
    if (error || !data) {
      callback(null);
      return;
    }

    try {
      const json = JSON.parse(data);

      if (!json || !json[0]) {
        callback(null);
        return;
      }

      const translatedAll = json[0].map(function (x) {
        return x[0];
      }).join("");

      const parts = translatedAll.split(SPLIT_MARK);

      if (parts.length !== texts.length) {
        callback(null);
        return;
      }

      callback(parts.map(function (x) {
        return x.trim() || "【翻译失败：空结果】";
      }));
    } catch (e) {
      callback(null);
    }
  });
}

function translateAll(texts, targetLang, callback) {
  let results = new Array(texts.length);
  let index = 0;

  function nextBatch() {
    if (index >= texts.length) {
      callback(results);
      return;
    }

    const start = index;
    const batch = texts.slice(start, start + BATCH_SIZE);

    googleTranslateBatch(batch, targetLang, function (batchResult) {
      // 批量失败时，降级逐条翻译
      if (!batchResult) {
        let local = new Array(batch.length);
        let j = 0;

        function nextOne() {
          if (j >= batch.length) {
            for (let k = 0; k < batch.length; k++) {
              results[start + k] = local[k] || "【翻译失败：单条缺失】";
            }

            index += BATCH_SIZE;
            nextBatch();
            return;
          }

          googleTranslateOne(batch[j], targetLang, function (oneResult) {
            local[j] = oneResult || "【翻译失败：单条未生成】";
            j++;
            nextOne();
          });
        }

        nextOne();
        return;
      }

      for (let i = 0; i < batch.length; i++) {
        results[start + i] = batchResult[i] || "【翻译失败：批量缺失】";
      }

      index += BATCH_SIZE;
      nextBatch();
    });
  }

  nextBatch();
}

// ================= Main =================

if (!isTimedText(body)) {
  const msgBody = makeMessageBody("【翻译失败：当前响应不是 timedtext】");

  $done({
    status: 200,
    headers: makeHeaders($response.headers, msgBody, "STATELESS_NOT_TIMEDTEXT"),
    body: msgBody
  });

  return;
}

const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/g;
const matches = [];
let match;

while ((match = pRegex.exec(body)) !== null) {
  matches.push(match);
}

if (!matches.length) {
  const msgBody = makeMessageBody("【翻译失败：没有字幕节点】");

  $done({
    status: 200,
    headers: makeHeaders($response.headers, msgBody, "STATELESS_NO_P_NODES"),
    body: msgBody
  });

  return;
}

const items = [];

matches.forEach(function (m, idx) {
  const text = extractText(m[2]);

  if (text) {
    items.push({
      index: idx,
      text: text
    });
  }
});

if (!items.length) {
  const msgBody = makeMessageBody("【翻译失败：字幕文本为空】");

  $done({
    status: 200,
    headers: makeHeaders($response.headers, msgBody, "STATELESS_EMPTY_TEXT"),
    body: msgBody
  });

  return;
}

const originals = items.map(function (x) {
  return x.text;
});

translateAll(originals, TARGET_LANG, function (translatedTexts) {
  const translatedByPIndex = {};

  for (let i = 0; i < items.length; i++) {
    translatedByPIndex[items[i].index] =
      translatedTexts[i] || "【翻译失败：未生成结果】";
  }

  let pIndex = 0;
  let replaced = 0;

  const newBody = body.replace(pRegex, function (whole, attrs, content) {
    const original = extractText(content);

    if (!original) {
      pIndex++;
      return whole;
    }

    const translated = translatedByPIndex[pIndex] || "【翻译失败：未生成结果】";
    pIndex++;
    replaced++;

    return '<p' + attrs + '>' + encodeXml(translated) + '</p>';
  });

  const debug =
    "STATELESS_OK" +
    ";target=" + TARGET_LANG +
    ";count=" + items.length +
    ";replaced=" + replaced;

  $done({
    status: 200,
    headers: makeHeaders($response.headers, newBody, debug),
    body: newBody
  });
});
