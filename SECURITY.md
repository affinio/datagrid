# Security Policy

## Reporting A Vulnerability

Please do not open a public GitHub issue for security reports.

Report vulnerabilities privately by email:

```text
support@affino.dev
```

Include, when possible:

- affected package and version
- installation/runtime context
- reproduction steps
- proof-of-concept code or request payloads
- expected impact
- whether the report affects community packages, enterprise packages, or both

We aim to acknowledge valid reports within 72 hours.

## Supported Versions

Security fixes target the latest released versions of maintained Affino DataGrid packages.

Current DataGrid package families include:

- `@affino/datagrid-core`
- `@affino/datagrid-vue`
- `@affino/datagrid-vue-app`
- `@affino/datagrid-server-adapters`
- `@affino/datagrid-server-client`
- `@affino/datagrid-worker`
- `@affino/datagrid-spreadsheet-vue-app`
- enterprise DataGrid packages where applicable

There is no package named `@affino/datagrid` in this workspace. Do not use that name when reporting affected install paths unless a future release adds it.

Older versions may not receive security updates. Users should upgrade to the latest compatible release.

## Responsible Disclosure

We ask researchers to:

- give maintainers reasonable time to investigate and fix the issue before public disclosure
- avoid accessing, modifying, or deleting data that does not belong to you
- avoid service disruption beyond what is necessary to demonstrate impact
- keep vulnerability details private until maintainers confirm disclosure timing

## Safe Harbor

Security research conducted under this policy is considered authorized and in good faith. We will not pursue legal action against researchers who follow this policy and report vulnerabilities responsibly.

## Acknowledgements

We appreciate responsible reports and may acknowledge valid findings with the reporter's permission.
