# Development History

This project evolved through real Surge iOS captures rather than a clean first-pass design. The history is kept because many failed attempts explain why the current architecture exists.

## Current Public Channels

| Channel | Purpose |
| --- | --- |
| `main` | Stable user-facing branch. Normal users should install the module from this branch. |
| `beta` | Active test branch. Used for risky diagnostics, long-video changes, and Google Translate behavior experiments. |
| `beta1` | Historical experimental branch for the early parallel-chunk module. |
| `release/v2026.05.02.1` | Historical release branch, kept for traceability. |
| `vYYYY.MM.DD.N` | Stable tags. |
| `betaNN` / `vYYYY.MM.DD.N-beta.N` | Test tags used to match user captures to exact code. |

## Stable Releases

| Version | Summary |
| --- | --- |
| `v2026.05.02.3` | Promoted beta25 to main. Stable module includes target-language 302 flow, bilingual modes, long-track budget, Google failure counters, and subtitle-visible failure reasons. |
| `v2026.05.02.2` | Promoted long-track baseline. Raised timedtext body limit and documented long `variant=gemini` limitations. |
| `v2026.05.02.1` | Promoted earlier beta baseline with request-side 302 and module packaging. |
| `v2026.05.01.9` | Parallelized translation chunks. |
| `v2026.05.01.8` | Capped translation wait time to reduce YouTube app timeout failures. |
| `v2026.05.01.7` | Early public module/readme state after renaming and docs cleanup. |

## Beta Line After `v2026.05.02.2`

| Tag | Summary |
| --- | --- |
| `beta25` | Show concrete failure reasons in subtitle body, not only headers. |
| `beta24` | Fast-return diagnostics when Google Translate redirects to Sorry/3xx and no usable translation is applied. |
| `beta23` | Detect Google Sorry redirects separately from parse failures. |
| `beta22` | Add detailed translation failure counters. |
| `beta20` | Scope all-cue diagnostics so ordinary English captions are not polluted by default. |
| `beta19` | Cover all cues with diagnostics during beta debugging. |
| `beta18` | Show translation failure diagnostics in timedtext body. |
| `beta17` | Show no-meta diagnostics during beta testing. |
| `beta16` | Keep POST translation but add GET fallback inside the same response script. |
| `beta15` | Strict translation intent and batching; remove broad track-level target language fallback. |
| `beta14` | Expand long-track budget and body handling. |
| `beta13` | Bump beta module version. |

## Early Beta Tags

| Tag | Summary |
| --- | --- |
| `v2026.05.01.10-beta.11` | Preserve clean timedtext URL order after deleting `tlang`. |
| `v2026.05.01.10-beta.10` | Avoid cached English track pollution. |
| `v2026.05.01.10-beta.9` | Persist track metadata for repeated clean requests. |
| `v2026.05.01.10-beta.8` | Add translation diagnostics. |
| `v2026.05.01.10-beta.7` | Stabilize reload cache keys. |
| `v2026.05.01.10-beta.6` | Simulate subtitle reload with local 302. |
| `v2026.05.01.10-beta.5` | Fill cache through repeated seeks. |
| `v2026.05.01.10-beta.3` | Show full-track translate error. |
| `v2026.05.01.10-beta.2` | Limit translation concurrency. |
| `v2026.05.01.10-beta.1` | Add early parallel chunk module on `beta1`. |

## Important Non-Tagged Milestones

| Commit Topic | Lesson |
| --- | --- |
| Stable response translation | Direct response body replacement works. YouTube iOS accepts modified timedtext XML if the XML shell and timings are preserved. |
| Bound translation latency | YouTube can close the caption request before slow translation completes. |
| Limit translation to English captions | Blindly translating every clean timedtext response pollutes normal captions. |
| Preserve requested target language | The target language must come from the original `tlang`, not from a hard-coded Chinese default. |
| Add Surge timedtext module | Packaging as `.sgmodule` makes normal installation possible. |
| Split languages in README | GitHub homepage should be Chinese-first and English-second, not interleaved line by line. |
| Add YouTube and Surge screenshots | Visual evidence helps users match the exact failure. |
| Add bilingual output option | `dual`, `reverse`, and `single` make the module usable beyond Chinese-only testing. |
| Center ASR timedtext layout | Auto-generated captions often use roll-up/left layout; bilingual output needs bottom-centered display. |
| Segment long timedtext cues | ASR timed `<s>` nodes must be split carefully to avoid unreadable long lines. |
| Merge/enrich short ASR captions | Over-aggressive splitting creates one-word flashes; nearby context helps readability. |
| Sync post-README commit history | README should mention capabilities, but detailed history belongs in docs. |

## Failed or Rejected Approaches

| Approach | Result |
| --- | --- |
| Pure URL Rewrite deleting `tlang` | Avoids YouTube 429 but loses target language. |
| Request script URL mutation only | Not reliable enough in live timedtext testing. |
| URL marker parameters such as `_yt_x`, `_yt_trg`, or custom flags | Can trigger YouTube instability or 429. |
| Global `last_state` target-language cache | Pollutes unrelated videos and normal captions. |
| Video-wide persistent target-language cache | Same video later selecting English CC can incorrectly show translated subtitles. |
| One-shot pending state | YouTube prefetch can consume it before the displayed request. |
| Request header marker | Response script did not reliably read the custom request marker. |
| Full-stream subtitle patching after `$done` | Surge response scripts cannot later patch a response already returned to YouTube. |
| Public Azure/DeepL provider by default | Official APIs require private credentials; not safe for a public module. |

## Community and Reference Trail

- YouTube Help Community reports showed the issue had existed beyond one local configuration.
- Reddit threads showed users across regions experienced auto-translate subtitle failures.
- ReVanced Extended issue reports confirmed this class of timedtext/auto-translate problem affected other clients and patch ecosystems.
- DualSubs and DualSubs/Universal informed subtitle mode, module-argument, and bilingual output thinking.
- NodeSeek/TraderYao observations supported the idea that clean overseas exits or overseas SIM traffic can avoid the 429 path.

## Current Conclusion

The current stable design is not "YouTube fixed"; it is a local workaround:

- avoid sending risky `tlang` to YouTube under affected exits;
- preserve target-language intent locally;
- translate source timedtext XML inside Surge;
- make failures visible in subtitles and headers.

The remaining hard boundary is very long subtitles under foreground response constraints. A future truly robust solution may require a private local/remote translation cache service rather than a pure Surge response script.
