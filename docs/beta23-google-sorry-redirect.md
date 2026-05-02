# Beta23 Google Sorry Redirect Detection

## Goal

Detect Google anti-automation redirects as a first-class failure reason.

## Behavior

- 3xx responses from Google Translate are no longer counted as parse failures.
- Redirects to `google.com/sorry` increment `postSorry` or `getSorry`.
- Other 3xx responses increment `postRedirect` or `getRedirect`.
- The module exposes `provider=google` as the current default and only active provider.

## Provider Note

Microsoft/Azure Translator is not enabled in beta23. The official Azure Translator API requires authentication headers, and unofficial public endpoints are not safe enough to present as a supported module option yet.

