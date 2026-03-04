# Contributing to Affino DataGrid

Thanks for contributing to Affino DataGrid packages.

## Core principles

- Headless-first architecture.
- Deterministic behavior over implicit magic.
- Clear package boundaries (`core` vs adapters).
- Test and docs updates for behavior/API changes.

## Development setup

Requirements:

- Node.js `20.x` (recommended)
- `pnpm`

Install:

```bash
pnpm install
```

Useful commands:

```bash
pnpm run check
pnpm run build
pnpm run test:datagrid:unit
pnpm run test:datagrid:contracts
pnpm run test:datagrid:integration
```

## Pull request requirements

- Use the PR template in `/.github/PULL_REQUEST_TEMPLATE.md`.
- Keep PR scope focused (one logical change).
- Add/update tests for behavior changes.
- Update docs/README for public API or integration contract changes.
- Add release notes context for releasable package changes (or explain why not needed).

## Ownership and review

- Ownership is defined in `/.github/CODEOWNERS` when present.

## Reporting

- Bugs/features: use repository issues.
- Security issues: follow `SECURITY.md` and report privately.

## Code of conduct

By participating, you agree to `CODE_OF_CONDUCT.md`.
