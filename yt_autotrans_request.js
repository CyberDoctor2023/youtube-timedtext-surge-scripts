const META_TTL_MS = 10 * 60 * 1000;

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

function trackMetaKey(urlString) {
  try {
    const url = new URL(urlString);
    const keys = ["v", "lang", "kind", "variant", "format"];
    const parts = [url.origin, url.pathname];

    for (let index = 0; index < keys.length; index += 1) {
      parts.push(keys[index] + "=" + (url.searchParams.get(keys[index]) || ""));
    }

    return "yt_tt_track_" + hashString(parts.join("|"));
  } catch (error) {
    return "yt_tt_track_" + hashString(urlString);
  }
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
      const redirectUrl = canonicalTimedtextUrl(cleanUrl);
      const meta = {
        sourceLang: sourceLang,
        targetLang: targetLang,
        cleanUrl: redirectUrl,
        createdAt: Date.now(),
        expiresAt: Date.now() + META_TTL_MS
      };

      $persistentStore.write(JSON.stringify(meta), metaKey(cleanUrl));
      $persistentStore.write(JSON.stringify(meta), metaKey(redirectUrl));
      $persistentStore.write(JSON.stringify(meta), trackMetaKey(cleanUrl));
      $persistentStore.write(JSON.stringify(meta), trackMetaKey(redirectUrl));

      console.log(
        "YouTube timedtext redirect cached: " +
          sourceLang +
          " -> " +
          targetLang
      );

      $done({
        response: {
          status: 302,
          headers: {
            Location: redirectUrl,
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
            "Content-Type": "text/plain; charset=UTF-8"
          },
          body: ""
        }
      });
    }
  }
} catch (error) {
  console.log("YouTube timedtext request script error: " + error);
  $done({});
}
