# DataGrid OSS Ecosystem Audit

Date: 2026-05-24

Perspective: Affino DataGrid as an open-source ecosystem project.

Docs read before this audit:

- `docs/datagrid-versioned-public-protocol.md`
- `docs/datagrid-public-api-inventory.md`
- `docs/datagrid-migration-guide.md`
- `docs/datagrid-plugin-lifecycle.md`
- `docs/datagrid-plugin-capability-model.md`
- `README.md`

Additional local checks:

- Root `package.json` scripts and quality gates.
- Repository community files discovered through `rg --files`.
- `.github/workflows/ci.yml` presence.

## Executive Summary

Affino DataGrid has unusually strong internal engineering discipline for an OSS-facing DataGrid project: tiered entrypoints, public protocol rules, export-map controls, API inventory checks, declaration reports, codemod support, contract tests, performance gates, plugin capability boundaries, and migration notes.

The main OSS adoption gap is not technical rigor. It is that the rigor is presented as internal platform process rather than as external trust signals. The root README still reads like a private monorepo. There is no obvious contributor path, no visible community governance files, no issue/PR guidance, and no concise public release/semver policy page for package users.

OSS maturity score: **7.0 / 10**.

- Engineering/process maturity: **8.5 / 10**
- Public API discipline: **8.5 / 10**
- Documentation organization for maintainers: **7.5 / 10**
- Documentation organization for external users: **5.5 / 10**
- Contributor friendliness: **4.5 / 10**
- External trust signals: **5.0 / 10**

The fastest path to stronger OSS readiness is not new architecture. It is packaging the existing discipline into public-facing docs: `CONTRIBUTING.md`, semver/release policy, package map, beginner docs, community standards, and a contributor-friendly validation matrix.

## 1. OSS Maturity Score

Overall score: **7.0 / 10**

| Area | Score | Rationale |
| --- | ---: | --- |
| Package boundaries | 8 | Clear tiered entrypoints exist for core, Vue, Vue app, server adapters, and plugin layers. Some package story confusion remains around app entrypoints and unpublished/planned packages. |
| Semver story | 8 | Versioned public protocol, deprecation windows, codemod plan, and stable/advanced/internal rules are strong. Needs a public release policy and consumer-facing semver summary. |
| Public API discipline | 9 | Export inventory, API report, flat API checks, source-shaped deep import blocking, and migration notes are enterprise-grade. |
| Migration story | 7 | Migration guide and codemod exist, but current guide is legacy/internal migration heavy and not yet organized as user-facing version migration notes. |
| Docs organization | 6 | Rich docs exist, but entry flow mixes user docs, internal planning, audits, package references, and advanced protocol material. |
| Contributor approach | 4 | No obvious `CONTRIBUTING.md`, issue templates, PR template, code of conduct, or community support workflow found. |
| Discoverability | 5 | Root README does not communicate product, package choice, examples, or contributor path quickly. |
| External trust signals | 5 | Strong quality scripts and CI exist, but badges, release status, governance, security policy, roadmap, and compatibility matrix are not prominent. |
| Ecosystem friendliness | 7 | Plugin model, capability boundary, stable API tiers, and package docs are promising. Needs public extension examples and third-party contribution guidance. |

## 2. Biggest Trust Risks For External Adoption

| Risk | Why it matters | Evidence | Minimal fix |
| --- | --- | --- | --- |
| Root README reads as private monorepo | External users judge maturity from the landing page. | README starts with “Affino DataGrid Monorepo”, package list, setup, commands, benchmarks. | Rewrite README opening for product, install, package choice, and trust signals. |
| No visible contributor guide | OSS contributors need workflow, expectations, tests, style, and review process. | No `CONTRIBUTING.md` discovered. | Add concise `CONTRIBUTING.md`. |
| No visible community standards | Serious OSS projects usually expose code of conduct, security policy, issue/PR templates. | Only `.github/workflows/ci.yml` found under `.github`. | Add `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue templates, PR template. |
| Semver discipline is internal-facing | Users need to know what is stable without reading protocol internals. | Strong protocol docs exist, but root README does not summarize them. | Add public “API stability and semver” section/page. |
| Package entrypoint confusion | Users may not know which package is stable/default. | Feature catalog references `@affino/datagrid`; README omits `@affino/datagrid-vue-app`. | Add package map and remove/mark unpublished package references. |
| Migration guide starts from temporary internal tree | External adopters may not relate to `.tmp/ui-table`. | `datagrid-migration-guide.md` baseline is `.tmp/ui-table` migration. | Split external version migration notes from internal historical migration. |
| Plugin story has three extension shapes | Powerful, but confusing for ecosystem authors. | `api.plugins`, `@affino/datagrid-plugins`, and Vue `createGrid(...).use(feature)`. | Add public “which extension model should I use?” guide with examples. |
| Quality gates are intimidating | Many scripts prove maturity but are too heavy for first contributors. | Root package has extensive test/bench/quality scripts. | Add contributor validation tiers: docs-only, package change, API change, perf-sensitive change. |
| Enterprise/internal docs are interleaved with OSS docs | Can create uncertainty about what community users can rely on. | Docs index contains internal-like audits and enterprise boundary docs near user docs. | Separate public docs, contributor docs, internal docs, and enterprise docs more clearly. |
| Demo/sandbox is validation-oriented | External users may not see a polished OSS project. | Sandbox header says manual validation/future E2E. | Add showcase landing and keep debug sandbox available. |

## 3. What Looks Enterprise-Grade Already

### Public protocol discipline

Strong signals:

- versioned public protocol rules
- stable, advanced, internal tiers
- forbidden deep imports
- package export-map enforcement
- deprecation windows with `deprecatedIn`, `removeIn`, `replacement`, and `codemodCommand`
- codemod support for breaking changes
- contract tests for public protocol and codemod behavior

### API inventory and declaration reports

Strong signals:

- generated public API inventory
- declaration-level API report
- explicit snapshot policy
- migration notes required for public API movement
- public type changes require semver review before refreshing baselines

### Migration tooling

Strong signals:

- codemod command exists
- migration guide includes import mappings, namespace migration, deep import migration, validation commands, and rollback strategy
- flat API migration examples are concrete

### Package tiering

Strong signals:

- `@affino/datagrid-core` root/advanced/internal tiering
- `@affino/datagrid-vue` root/stable equivalence and advanced subpaths
- `@affino/datagrid-vue-app` stable app-facing root and feature subpaths
- explicit warning that `./internal` is unsafe/internal

### Plugin capability boundary

Strong signals:

- stable public plugin facade on `DataGridApi.plugins`
- capability-gated advanced runtime model
- denied capability diagnostics
- explicit bridge rules between public plugin facade, advanced runtime plugins, and Vue features
- event payload snapshotting and error isolation

### Quality and performance gates

Strong signals:

- contract, strict-contract, integration, e2e, and perf gates
- API inventory and report scripts
- benchmark budgets for major subsystems
- architecture quality lock scripts

## 4. What Still Feels Internal / Platform-Oriented

| Area | Why it feels internal | External-facing reframing |
| --- | --- | --- |
| README title | “Monorepo” is maintainer framing. | “Affino DataGrid” product landing. |
| Package list | Lists internal/support packages before app entrypoint. | Start with package decision table by user need. |
| Benchmark table | Useful but too early and too detailed. | Move to performance docs; show one short trust summary in README. |
| Migration guide | Starts from `.tmp/ui-table`. | Create external version migration guide; keep historical migration as internal/reference. |
| API protocol docs | Excellent but dry and implementation-heavy. | Add public semver guarantee summary. |
| Plugin docs | Correct but abstract. | Add extension author examples: analytics plugin, toolbar plugin, diagnostics plugin. |
| Quality scripts | Dense command list with many heavy gates. | Add validation tiers for contributors. |
| Docs index | Mixes user-facing docs, audits, internal-ish plans, and protocol references. | Add “Start here”, “API reference”, “Contributor”, “Maintainer/internal” groups. |
| Sandbox | Described as manual validation/E2E. | Present as “Demos” with debug mode for maintainers. |

## 5. What Blocks Community Contributions

### Missing contribution workflow

External contributors need to know:

- how to set up the repo
- which package to change
- which tests to run
- how to update API baselines
- when to update migration docs
- when not to touch internal packages
- how to propose public API changes
- how to report performance-sensitive changes

Current docs contain parts of this, but not in one contributor guide.

### No obvious issue/PR process

Missing or not discovered:

- issue templates
- PR template
- bug report format
- feature request format
- API proposal format
- performance regression report format

### Validation commands are too broad

Root README lists broad commands, while package-level contributor flows need smaller validation slices.

Recommended tiers:

| Change type | Minimum validation |
| --- | --- |
| Docs-only | link/content check if available; no full monorepo required. |
| Package docs/readme | package type-check if examples/types changed. |
| Stable API docs | API inventory/report only if exports/types changed. |
| Core model behavior | `@affino/datagrid-core` unit/contracts + relevant type-check. |
| Vue adapter behavior | `@affino/datagrid-vue` unit/contracts + type-check. |
| Vue app behavior | `@affino/datagrid-vue-app` tests/type-check + targeted sandbox/e2e if visible. |
| Public API change | API proposal, inventory/report refresh, migration guide update. |
| Perf-sensitive change | smallest relevant benchmark before wider quality lock. |

### Public API change process is not contributor-facing

The repo has API discipline, but contributors need a simple rule:

> Do not add, remove, rename, or move public exports without an API proposal and migration note.

### Plugin contribution path lacks examples

The plugin lifecycle is well designed but needs practical examples:

- stable observer plugin using `api.plugins`
- capability-gated host plugin using `@affino/datagrid-plugins`
- Vue-only local feature using `createGrid(...).use(feature)`

### Enterprise/community boundary can intimidate contributors

External contributors may avoid touching anything if they cannot tell community vs enterprise ownership. A public package map should label:

- community stable
- community advanced
- enterprise add-on
- internal/unsafe

## 6. Minimal High-ROI Fixes

| Priority | Fix | Why high ROI | Impact estimate |
| ---: | --- | --- | --- |
| 1 | Add `CONTRIBUTING.md` with setup, package boundaries, validation tiers, API change rules, and docs rules. | Converts existing process into contributor guidance. | Very high |
| 2 | Rewrite root README opening for external users. | First trust surface currently underperforms. | Very high |
| 3 | Add public package map. | Reduces package confusion and API-tier anxiety. | High |
| 4 | Add public semver/API stability page. | Turns internal protocol rigor into trust. | High |
| 5 | Add PR template and issue templates. | Makes contribution expectations visible. | High |
| 6 | Add `SECURITY.md` and `CODE_OF_CONDUCT.md`. | Standard OSS trust signals. | Medium-high |
| 7 | Split migration docs into public version migration vs historical/internal migration. | Makes migration story relevant to external users. | Medium-high |
| 8 | Add plugin author quick start. | Improves ecosystem friendliness. | Medium |
| 9 | Add docs index grouping for user/contributor/API/internal. | Improves discoverability. | Medium |
| 10 | Add release/changelog policy. | Helps users trust version movement. | Medium |

## Prioritized Roadmap

| Priority | Slice | Change | Impact | Notes |
| ---: | --- | --- | --- | --- |
| 1 | Contributor guide | Create `CONTRIBUTING.md` with setup, package boundaries, validation tiers, API review rules, docs expectations, and commit style. | Very high | Docs-only, no API risk. |
| 2 | Root README trust pass | Add product positioning, package choice, quick start, semver stability summary, contributor link, docs link. | Very high | Align with existing adoption/readme audits. |
| 3 | Package map | Create `docs/datagrid-package-map.md` covering package purpose, tier, audience, import path, community/enterprise status. | High | Should resolve `@affino/datagrid` ambiguity. |
| 4 | Public API stability page | Create `docs/datagrid-api-stability.md` summarizing stable/advanced/internal, semver, deprecations, codemods, deep import rules. | High | Keep protocol doc as detailed reference. |
| 5 | GitHub community files | Add issue templates, PR template, `SECURITY.md`, `CODE_OF_CONDUCT.md`. | High | Standard OSS trust signals. |
| 6 | External migration notes | Create `docs/datagrid-version-migration.md` for package users; move `.tmp/ui-table` history lower or internal. | Medium-high | Keep existing migration guide for historical context. |
| 7 | Plugin author guide | Create `docs/datagrid-plugin-authoring.md` with three examples: public API plugin, capability runtime plugin, Vue feature. | Medium | Builds ecosystem confidence. |
| 8 | Contributor validation matrix | Add `docs/datagrid-contributor-validation.md` or section in `CONTRIBUTING.md`. | Medium | Prevents contributors from running full expensive gates unnecessarily. |
| 9 | Docs index restructure | Update `docs/README.md` into user, API, server, contributor, quality, internal/reference sections. | Medium | Improves navigation without moving files. |
| 10 | Release policy | Add concise release/changelog policy naming package versioning, semver rules, deprecation windows, and changelog expectations. | Medium | Can link to package changelogs. |
| 11 | Plugin examples package or examples folder | Add tiny plugin examples after docs are stable. | Medium | More work; useful for ecosystem. |
| 12 | Showcase demo trust pass | Add external-facing demo hierarchy from sandbox audit. | Medium | Boosts adoption but not strictly OSS governance. |

## Impact Per Slice

| Slice | External trust | Contributor velocity | Adoption clarity | Risk |
| --- | ---: | ---: | ---: | --- |
| `CONTRIBUTING.md` | High | Very high | Medium | Low |
| Root README trust pass | Very high | Medium | Very high | Low |
| Package map | High | High | High | Low |
| API stability page | Very high | Medium | High | Low |
| GitHub community files | High | Medium | Medium | Low |
| External migration notes | Medium-high | Medium | High | Low |
| Plugin author guide | Medium | High for ecosystem authors | Medium | Low |
| Contributor validation matrix | Medium | High | Medium | Low |
| Docs index restructure | Medium | Medium | High | Low |
| Release policy | High | Medium | Medium | Low |
| Plugin examples | Medium | Medium | Medium | Medium |
| Demo trust pass | Medium | Low | High | Medium |

## Recommended Public Trust Signals

Add to README or docs landing:

- Stability model: stable / advanced / internal.
- Public API inventory and declaration report are checked.
- Deep imports are intentionally blocked.
- Migration codemod exists for public protocol changes.
- Contract tests cover public protocol and entrypoint tiers.
- Performance budgets exist for core workloads.
- Community packages are production-useful; enterprise is additive.
- Contributor validation matrix tells contributors what to run.

Suggested wording:

> Affino DataGrid treats public APIs as versioned contracts. Stable entrypoints are semver-safe, advanced entrypoints are for power users with shorter deprecation windows, and internal entrypoints are explicitly unsafe. Public export maps, declaration reports, codemods, and contract tests keep the package boundary enforceable.

## Recommended Contributor Guide Outline

1. Project overview.
2. Package boundaries.
3. Stable, advanced, internal API rules.
4. Local setup.
5. Common validation commands by change type.
6. Public API change process.
7. Migration docs and codemod expectations.
8. Performance-sensitive changes.
9. Documentation expectations.
10. Commit message format.
11. PR checklist.
12. Where to ask questions / issue labels.

## Recommended Public API Stability Page Outline

1. What is stable.
2. What is advanced.
3. What is internal.
4. Forbidden deep imports.
5. Deprecation windows.
6. Codemod support.
7. API inventory/report checks.
8. Migration notes requirement.
9. Consumer guidance: what to import for common use cases.

## Recommended Plugin Authoring Guide Outline

1. Which extension model should I use?
2. Stable observer plugin with `api.plugins`.
3. Capability-gated plugin with `@affino/datagrid-plugins`.
4. Vue feature with `createGrid(...).use(feature)`.
5. Bridge rules.
6. Capability denial and diagnostics.
7. Semver and public API safety.

## Bottom Line

Affino DataGrid already has the hard parts of serious OSS API governance: tiered public contracts, API snapshots, codemods, migration notes, plugin boundaries, and quality gates. The project now needs the social and navigational layer of OSS maturity: contributor docs, community files, public stability summary, package map, release policy, and a README that communicates product value before internal process.
