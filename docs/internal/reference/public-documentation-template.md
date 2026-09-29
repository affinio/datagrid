# Public documentation template

Status: maintainer guidance.

Use this template when adding or substantially revising a user-facing DataGrid document. Keep the public path task-oriented; put audits, hypotheses, comparisons, and unfinished designs under `docs/internal/`.

## Required shape

```md
# Specific task or API name

Status: public guide | public reference | advanced reference.

One paragraph explaining who should read this page and what it enables.

## Prerequisites

- Package and supported entrypoint.
- Required runtime mode or backend responsibility.

## Minimal example

<!-- A copyable, production-shaped example using current package names and APIs. -->

## Configuration or API

<!-- Parameters, defaults, return values, events, errors, and lifecycle rules. -->

## Limitations

<!-- Explicitly mark partial/planned behavior; link to support-status.md. -->

## Related docs

- Canonical guide or API reference.
- Troubleshooting or migration note only when the reader needs it.
```

## Package README rules

Each public package README should contain only:

- what the package owns;
- install/import example for its stable entrypoint;
- a short documentation map to the canonical guide and API reference;
- stability and support-status notes;
- links to advanced/internal material when a maintainer needs it.

Do not duplicate the full API or feature catalog in a package README. Keep one canonical explanation and link to it.

## API accuracy checklist

- Verify package names and export paths against `package.json`.
- Verify method signatures and parameter names against emitted declarations.
- Show defaults and failure behavior, not only happy-path calls.
- Label stable, advanced, internal, implemented, partial, and planned behavior.
- Run `pnpm run docs:api:datagrid:generate` after package declarations are built.
- Run the Markdown link check and `git diff --check` before publishing.

