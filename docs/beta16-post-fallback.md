# Beta16 POST Fallback Notes

## Goal

Keep the POST translation path, but make fallback happen inside the same Surge response script instead of relying on a user-driven subtitle reload.

## Changes

- POST remains the first translation attempt.
- POST chunk size is reduced so Google is less likely to reject or time out large form bodies.
- If POST fails, the script splits the same marked subtitle payload into GET-safe parts and retries them immediately.
- Long-track POST pressure is lowered from 8 concurrent requests to 4, while GET fallback uses at most 2 concurrent subrequests per failed chunk.

## Why Azure Is Not the Default

Azure Translator is a stable official REST API, but it requires subscription authentication headers on every request. Putting that key in a public Surge module would expose the user key, so Azure is better as an optional private gateway later.

