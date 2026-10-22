import { writeFile } from "node:fs/promises"

const root = `export * from "./app/index.js"\nexport * from "./headless/index.js"\nexport { default } from "./app/index.js"\n`
await writeFile(new URL("../dist/index.js", import.meta.url), root)
await writeFile(new URL("../dist/index.d.ts", import.meta.url), root)
