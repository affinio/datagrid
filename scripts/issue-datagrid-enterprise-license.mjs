#!/usr/bin/env node

const LICENSE_PREFIX = "affino-dg-v1"
const LICENSE_SALT = "affino-dg-enterprise-2026"
const VALID_TIERS = new Set(["trial", "enterprise"])
const VALID_FEATURES = new Set([
  "all",
  "diagnostics",
  "formulaRuntime",
  "formulaPacks",
  "performance",
])

function fnv1a32(input) {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function checksumForPayload(payload) {
  return fnv1a32(`${payload}|${LICENSE_SALT}`)
    .toString(36)
    .toUpperCase()
    .padStart(7, "0")
}

function normalizeCustomer(customer) {
  return customer
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseArgMap(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--")) {
      continue
    }
    const key = token.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith("--")) {
      result[key] = "true"
      continue
    }
    result[key] = next
    index += 1
  }
  return result
}

function parseFeatures(rawFeatures) {
  const source = typeof rawFeatures === "string" && rawFeatures.trim().length > 0
    ? rawFeatures.split(",").map(entry => entry.trim()).filter(Boolean)
    : ["all"]
  const unique = []
  for (const feature of source) {
    if (!VALID_FEATURES.has(feature)) {
      throw new Error(`Unsupported feature: ${feature}`)
    }
    if (!unique.includes(feature)) {
      unique.push(feature)
    }
  }
  return unique.length > 0 ? unique : ["all"]
}

function assertIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid expires-at date: ${value}`)
  }
}

function printUsage() {
  console.error(
    [
      "Usage:",
      "  node scripts/issue-datagrid-enterprise-license.mjs \\",
      "    --customer acme-inc \\",
      "    --expires-at 2026-12-31 \\",
      "    [--tier trial|enterprise] \\",
      "    [--features all|diagnostics,formulaRuntime,formulaPacks,performance]",
    ].join("\n"),
  )
}

try {
  const args = parseArgMap(process.argv.slice(2))
  const customer = typeof args.customer === "string" ? normalizeCustomer(args.customer) : ""
  const expiresAt = typeof args["expires-at"] === "string" ? args["expires-at"].trim() : ""
  const tier = typeof args.tier === "string" ? args.tier.trim() : "enterprise"
  const features = parseFeatures(args.features)

  if (!customer) {
    throw new Error("Missing --customer")
  }
  if (!VALID_TIERS.has(tier)) {
    throw new Error(`Unsupported tier: ${tier}`)
  }
  if (!expiresAt) {
    throw new Error("Missing --expires-at")
  }

  assertIsoDate(expiresAt)

  const payload = [
    LICENSE_PREFIX,
    tier,
    customer,
    expiresAt,
    features.join(","),
  ].join(":")
  const key = `${payload}:${checksumForPayload(payload)}`

  console.log(key)
  console.error(
    JSON.stringify({
      tier,
      customer,
      expiresAt,
      features,
    }, null, 2),
  )
} catch (error) {
  printUsage()
  console.error("")
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
