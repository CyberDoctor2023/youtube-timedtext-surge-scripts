# Bilingual Layout Spec

## Goal

Add optional bilingual timedtext output for YT AutoTrans Error, keep it usable by default through Surge module parameters, and make YouTube ASR timedtext closer to native centered captions.

## Non-goals

- Do not rewrite the whole timedtext XML document.
- Do not reintroduce URL Rewrite based `tlang` deletion.
- Do not depend on request URL mutation as the core 429 workaround.
- Do not require Node.js APIs, `fetch`, `import`, or `require` inside Surge scripts.

## Completion Conditions

- Module exposes one Surge editable `mode` parameter for subtitle display mode.
- `mode=dual` means source above translation.
- `mode=reverse` means translation above source.
- `mode=single` means translated text only.
- Default behavior shows source above translation.
- Existing translation-only behavior remains available.
- Older `bilingual/order` script arguments remain compatible.
- Long ASR paragraphs are split by timed `<s>` tokens before translation.
- Splitting considers punctuation, rough display width, and token count.
- Splitting avoids one-word or two-word over-fragmentation for normal English ASR captions.
- ASR timedtext head/window style is normalized toward bottom-centered captions.
- Bilingual line breaks are encoded as `&#x000A;` instead of raw newlines.
- Empty ASR roll-up spacer paragraphs are removed in translated output.
- Manual captions and ASR captions are isolated; ASR-only layout fixes do not run on manual captions.
- ASR caption window column count is widened to allow longer single-line display.
- ASR internal splitting thresholds are relaxed to avoid one-word or two-word cues.
- Short ASR cues are enriched with nearby context without deleting or merging source paragraphs.
- ASR overlapping paragraph durations are clamped before the next caption starts.
- Response script keeps `<p>` timing attributes and only replaces subtitle text content.
- Response script uses a foreground-response deadline strategy: Google Translate requests time out quickly, up to 8 chunks are translated in parallel to preserve seek coverage, and slow translation returns an explicit timeout subtitle instead of waiting until the YouTube app closes the connection.
- Remote script URLs are versioned so module updates can force a fresh external script resource URL.
- The install URL points to the GitHub Release `.sgmodule` asset, and the visible module `version` argument matches the release/tag rather than a self-referential commit hash.
- README documents current features and design tradeoffs without a long commit-by-commit history.
- README uses a consistent Chinese-first, English-second structure: scope, evidence, install, options, flow, design notes, timedtext handling, cache, verification, limits, acknowledgements, references, and status.
- Scripts pass `node --check`.

## Validation Plan

- Review DualSubs Universal template for `#!arguments` / `#!arguments-desc` and subtitle composition ideas.
- Verify Surge module parameter syntax and external-resource commands against local CLI/help.
- Run syntax checks for request and response scripts.
- Search README/module for stale filenames and stale option names.
- Validate the response timeout strategy with syntax checks and real Surge timing captures where Active approaches 8 seconds.
- Publish the matching `.sgmodule` as a GitHub Release asset for the visible version tag.

## Follow-up Todos

- Tune timedtext centering further if real iOS captures show a different `wp/ws` enum is needed.
- Tune ASR grouping with more real auto-generated captions.
