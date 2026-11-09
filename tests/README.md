# Calculator checks

`jobs.json` holds the test jobs (inputs as field, value pairs; `POLY` is a real roof outline in feet).
`expected.json` holds the results each job produced when last confirmed correct.

The GitHub check runs `node tests/check.mjs` on every update and fails if any result changes.
When a change is intended, run `node tests/check.mjs --update` and commit the new `expected.json`.
