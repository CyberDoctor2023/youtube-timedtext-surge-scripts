# Beta18 Translation Failure Diagnostics

## Goal

Make long-track translation failures visible in the subtitle body.

## Behavior

- If `tlang` metadata exists but every POST / fallback GET translation request returns no usable text, the first cue is replaced with a diagnostic message.
- The rest of the long subtitle body is left untouched to avoid filling a multi-hour video with repeated error text.
- The response header includes `status=translate failed;diagnostic=first-cue` or `status=translate timeout;diagnostic=first-cue`.

## Why

Earlier beta builds used `fast-return` for long videos when no translation succeeded. That protected playback, but made a total translation failure look like normal English captions. Beta18 makes that state explicit for debugging.

