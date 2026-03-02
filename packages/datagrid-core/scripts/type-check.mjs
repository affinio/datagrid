import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(scriptDir, "..")

const commands = [
  "pnpm --filter @affino/datagrid-plugins run build",
  "pnpm --filter @affino/projection-engine run build",
  "tsc -p tsconfig.public.json --noEmit",
]

for (const command of commands) {
  execSync(command, {
    cwd: packageRoot,
    stdio: "inherit",
  })
}
