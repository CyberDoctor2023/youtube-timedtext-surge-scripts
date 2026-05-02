# Documentation Index

This directory keeps the long-form engineering record for YT AutoTrans Error. README is the user-facing entry point; these docs preserve the deeper investigation trail.

## Start Here

- [Architecture and Principles](architecture-and-principles.md): core request/response design, why local 302 is used, why pure rewrite is insufficient, and how translation intent is scoped.
- [Troubleshooting and Captures](troubleshooting-and-captures.md): real Surge symptoms, `429`, Google Sorry, timeout, no-meta, and long-video cases.
- [Development History](development-history.md): public tags, beta line, release line, and the reasoning behind each stage.
- [Official Auto-Translate Capture](overseas-sim-official-autotrans-flow.md): overseas SIM captures showing how YouTube behaves when the official path works.

## Feature Specs and Iteration Notes

- [Bilingual Layout Spec](bilingual-layout-spec.md): bilingual mode, ASR centering, cue splitting, cache, and known long-video constraints.
- [Long-Track Fast Return Spec](long-track-fast-return-spec.md): long/chunked timedtext response constraints.
- [Beta15 Translation Intent and Batching](beta15-translation-intent-and-batching.md)
- [Beta16 POST Fallback](beta16-post-fallback.md)
- [Beta17 Visible Diagnostics](beta17-visible-diagnostics.md)
- [Beta18 Translation Failure Diagnostics](beta18-translation-failure-diagnostics.md)
- [Beta19 All-Cue Diagnostics](beta19-all-cue-diagnostics.md)
- [Beta20 Scoped Diagnostics](beta20-scoped-diagnostics.md)
- [Beta22 Failure Counters](beta22-failure-counters.md)
- [Beta23 Google Sorry Redirect](beta23-google-sorry-redirect.md)
- [Beta24 Fast Redirect Diagnostics](beta24-fast-redirect-diagnostics.md)
- [Beta25 Subtitle Failure Reasons](beta25-subtitle-failure-reasons.md)

## Repository Policy

- `main`: stable user-facing branch. The normal Surge install URL points here.
- `beta`: active testing branch for risky subtitle/runtime changes.
- `beta1`: old experimental branch kept for traceability.
- `release/*`: historical release branches.
- `vYYYY.MM.DD.N`: stable tags.
- `betaNN` and `vYYYY.MM.DD.N-beta.N`: test tags kept so packet captures can be matched to code.

## Why Keep So Much History?

This project is mostly field research around YouTube iOS timedtext behavior under real networks. Many wrong paths were useful because they proved what does not work:

- URL Rewrite can avoid YouTube 429 but loses the target language.
- Broad persistent language state pollutes normal English captions.
- `POST` can reduce URL length pressure but can still hit Google anti-automation.
- Surge can modify the final XML, but cannot stream partial subtitle updates after `$done`.
- Long `variant=gemini` ASR tracks stress both body size and foreground response time.

Keeping these notes helps future maintainers avoid repeating the same experiments.
