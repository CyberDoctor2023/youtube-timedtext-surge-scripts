# Beta25 Subtitle Failure Reasons

## Goal

Make translation failures visible in the YouTube subtitle area, not only in `X-YT-AutoTrans`.

## Behavior

- `debug=translate` still only covers confirmed translation requests, so ordinary English CC is not intentionally polluted.
- When all cues fail to translate, every subtitle cue is replaced with the concrete failure reason.
- Headers still include counters such as `postSorry`, `getRedirect`, `postParse`, `getError`, and `missing`.
- Success path is unchanged: translated cues still render according to `mode=dual`, `mode=reverse`, or `mode=single`.

## Visible Messages

- `Google Sorry / 风控`: `translate.googleapis.com` redirected to Google Sorry.
- `Google 翻译重定向`: Google returned another 3xx instead of translation JSON.
- `翻译超时`: YouTube subtitle XML arrived, but translation did not complete within budget.
- `翻译请求错误`: POST/GET translation request hit a network error.
- `翻译 HTTP 错误`: Google returned a non-2xx HTTP status.
- `翻译响应解析失败`: Google responded, but the body was not the expected JSON.
- `翻译标记丢失`: batch markers were changed or not returned by the translator.
- `翻译结果为空`: response was present but no usable translation text was found.
