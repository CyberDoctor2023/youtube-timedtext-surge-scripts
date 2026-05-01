# Bilingual Layout Spec

## Goal

Add optional bilingual timedtext output for YT AutoTrans Error. The first implementation controls whether each existing timedtext paragraph shows source text plus translated text, and exposes that choice through Surge editable module parameters. Centering and sentence grouping are separate follow-up tasks.

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
- Response script keeps `<p>` timing attributes and only replaces subtitle text content.
- Scripts pass `node --check`.

## Validation Plan

- Review DualSubs Universal template for `#!arguments` / `#!arguments-desc` and subtitle composition ideas.
- Verify Surge module parameter syntax against local CLI/help and official manual where possible.
- Run syntax checks for request and response scripts.
- Search README/module for stale filenames and stale option names.

## Follow-up Todos

- Todo 2: center subtitle layout.
- Todo 3: sentence grouping for ASR captions.
