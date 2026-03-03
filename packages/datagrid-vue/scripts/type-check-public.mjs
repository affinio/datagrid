import { spawnSync } from "node:child_process"

const steps = [
  ["pnpm", ["--filter", "@affino/datagrid-core", "run", "build"]],
  ["pnpm", ["--filter", "@affino/datagrid-orchestration", "run", "build"]],
  ["pnpm", ["--filter", "@affino/datagrid-worker", "run", "build"]],
  ["pnpm", ["exec", "tsc", "-p", "tsconfig.public.json", "--noEmit"]],
]

for (const [command, args] of steps) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
