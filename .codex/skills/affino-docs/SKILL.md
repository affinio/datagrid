---
name: affino-docs
description: Use for Affino documentation work, including README files, architecture notes, audit documents, protocol docs, integration guides, package examples, onboarding docs, changelogs, migration notes, and keeping docs aligned with implemented code slices.
---

# Affino Docs

## Scope

Use this skill whenever the task is documentation-first or when a code slice changes architecture, UX, performance behavior, public contracts, integration behavior, validation expectations, or migration risk.

## Documentation Rules

- Keep docs concise, accurate, and actionable.
- Do not document aspirational behavior as implemented behavior.
- Separate current state, known gaps, recommended fixes, and roadmap items.
- Name affected packages, files, APIs, and behavior when useful.
- Prefer docs that help future maintainers make the next change safely.
- If docs are not needed for a code slice, final response should say `docs: not needed`.

## Common Artifacts

- Architecture and audit docs under `docs/`.
- Package READMEs for package-specific usage and integration.
- Protocol docs for request/response contracts, revisions, history, and datasource semantics.
- Migration notes when behavior or public API expectations change.
- Test plans and benchmark notes for performance-sensitive work.

## Doc Slice Workflow

1. Identify whether the doc is current-state, decision record, roadmap, integration guide, or migration note.
2. Verify claims against code before writing.
3. Update status and remaining work when closing planned slices.
4. Include validation or benchmark expectations when relevant.
5. Keep examples production-shaped and package-oriented.

## Style

- Use direct headings and short bullets.
- Prefer precise file/package references over generic statements.
- Avoid duplicating long code blocks unless they are essential API examples.
- Mark unresolved risks explicitly.
