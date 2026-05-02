# Documentation Structure Spec

## Goal

Make the repository understandable for two audiences:

- ordinary Surge users who only need the latest stable module and setup steps;
- developers who want the full debugging history, packet-capture evidence, failed approaches, and design tradeoffs.

## Non-Goals

- Do not delete historical beta notes.
- Do not hide known limitations.
- Do not make README a commit-by-commit changelog.
- Do not present the beta branch as the normal install path.

## Completion Conditions

- README starts with a clear stable install URL.
- README explains branch, tag, and release policy.
- README links to a docs index.
- Detailed captures, failure modes, and beta iteration notes are discoverable from docs.
- Version history includes all public tags and important non-tagged milestones from git history.
- The latest stable module version shown in README matches `yt-autotrans.sgmodule`.

## Validation Plan

- Search for stale module versions and stale release URLs.
- Check Markdown files for broken local doc links by filename.
- Run `surge-cli --check` and `node --check` after any module edits.
- Push docs to `main` so GitHub visitors see the same content as local users.
