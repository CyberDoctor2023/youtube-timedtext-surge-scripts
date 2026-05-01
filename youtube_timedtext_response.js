const TARGET_LANG = "zh-CN";
const SOURCE_LANG = "auto";
const BATCH_SIZE = 8;
const SPLIT_MARK = "<<<YT_TIMEDTEXT_SPLIT_9A7F>>>";

let body = $response.body || "";
let headers = Object.assign({}, $response.headers || {});

const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/g;
const sRegex = /<s\b[^>]*>([\s\S]*?)<\/s>/g;

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

function translate(text, callback) {
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
      timeout: 8
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

const items = [];
let match;

while ((match = pRegex.exec(body)) !== null) {
  items.push({
    attrs: match[1],
    text: extractText(match[2]),
    translated: ""
  });
}

if (items.length === 0) {
  normalizeHeaders();
  $done({
    body: body,
    headers: headers
  });
} else {
  let cursor = 0;
  let translatedCount = 0;

  function translateOneByOne(batch, done) {
    let index = 0;

    function nextOne() {
      if (index >= batch.length) {
        done();
        return;
      }

      const item = batch[index];
      index += 1;

      translate(item.text, function (translated) {
        if (translated) {
          item.translated = translated;
          translatedCount += 1;
        }

        nextOne();
      });
    }

    nextOne();
  }

  function translateNextBatch() {
    if (cursor >= items.length) {
      finish(items, translatedCount);
      return;
    }

    const batch = [];

    while (cursor < items.length && batch.length < BATCH_SIZE) {
      if (items[cursor].text) {
        batch.push(items[cursor]);
      }
      cursor += 1;
    }

    if (batch.length === 0) {
      translateNextBatch();
      return;
    }

    const joined = batch.map(function (item) {
      return item.text;
    }).join(SPLIT_MARK);

    translate(joined, function (translatedJoined) {
      const parts = translatedJoined ? translatedJoined.split(SPLIT_MARK) : [];

      if (parts.length === batch.length) {
        for (let index = 0; index < batch.length; index += 1) {
          if (parts[index] && parts[index].trim()) {
            batch[index].translated = parts[index].trim();
            translatedCount += 1;
          }
        }

        translateNextBatch();
        return;
      }

      translateOneByOne(batch, translateNextBatch);
    });
  }

  translateNextBatch();
}
