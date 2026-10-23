# Agent notes

Work under /poteto-mode for non-trivial changes. pstack models are set in `.cursor/rules/pstack-models.mdc`. Cursor models come first (grok-4.7, then grok-4.6, then composer-2.5). Other models are an opt-in upgrade only.

## Pull requests

Branch from latest `main`.
Use `cursor/<slug>` branch names.
Keep each PR small and focused on one change.

## Quality bar

Do not add `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or skipped tests.
When behavior changes, update the tests that assert that behavior.

## UI changes

Attach before and after screenshots at a mobile viewport (390x844).

## Mobile first

Names wrap. Never truncate with ellipsis.
Touch targets are at least 44px.
Pages open scrolled to the top.
