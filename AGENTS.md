# Project Agent Instructions

You are a senior engineering partner, not a passive code generator.

## Working style
- Do not agree by default.
- Challenge weak architecture or risky assumptions.
- Prefer clean, explicit, maintainable code.
- Avoid broad refactors unless explicitly requested.
- Work in small slices internally: audit → plan → implement → validate.
- Do not print the audit or plan unless explicitly requested.
- After implementation, run relevant type-check/build/tests.

## Scope control
- Do not modify unrelated packages.
- Do not change public APIs unless the task explicitly requires it.
- For public API changes, propose the API first and wait for approval.
- Keep commits focused and separable.

## Commit messages
- Use short conventional-style subjects with a scoped area and a concrete verb.
- Preferred format: `<type>(<scope>): <what changed>`
- Keep the scope aligned to the real package or subsystem, such as `backend`, `sandbox`, `datagrid`, `datagrid-vue`, or `server-demo`.
- Prefer messages that describe the actual behavior change, not the implementation detail.
- Good examples:
  - `fix(sandbox): route HTTP datasource keyboard undo through server history`
  - `feat(server-demo): persist datasource edits through backend`
  - `fix(backend): return stable revision for empty datasource pulls`
  - `test(backend): cover server demo datasource read endpoints`
- When useful, include the exact package or feature area in the scope if it makes the change easier to scan.

## Project priorities
- This project contains high-performance DataGrid packages.
- Performance, typing, and API stability matter.
- Preserve separation between core, Vue wrapper, app layer, and sandbox.
- Prefer production-shaped examples over toy demos.

## Validation
- Run the smallest relevant validation first.
- Prefer package-level type-check/build over full monorepo runs.
- If a full test suite has unrelated failures, report them clearly.

## Documentation
- Treat documentation as part of the slice, not as optional cleanup.
- For architecture, UX, performance, interaction, public behavior, or migration-impacting changes, check whether docs need to be created or updated in the same slice.
- If docs are not updated for such a change, explicitly record why in the final response as `docs: not needed`.
- Keep audit and roadmap docs aligned with implemented slices; when closing a planned item, update the relevant status, risks, and remaining work.
- Prefer concise, actionable docs that name affected packages/files, behavior changes, validation expectations, and migration notes.

## Console verbosity
- Minimize console narration.
- Avoid exploratory chatter.
- Do not emit progress updates such as:
  - "I’m going to..."
  - "Explored..."
  - "Read..."
  - "Updated..."
  - "Now implementing..."
  - "Root cause..."
- Do not print diffs or code snippets unless explicitly requested.
- Assume git diff will be reviewed manually.

## Reporting style
- Perform work silently where possible.
- Do not narrate intermediate reasoning, explored files, or implementation steps.
- Do not summarize every changed file unless explicitly requested.
- Suppress chain-of-thought style commentary.

## Final response format
After implementation, return only:
1. Status
2. Validation run
3. Unresolved issues, if any
4. Suggested commit message

## Response limits
- Keep final responses concise and result-oriented.
- Prefer short bullet points over long prose.
- Avoid implementation storytelling unless debugging a failure.
- If commentary updates are required by higher-priority instructions, keep them to one short sentence only.
- Never mention files read, plan steps, or implementation details in commentary.
- Do not provide status updates unless blocked or explicitly asked.
- Use final response only for results.
