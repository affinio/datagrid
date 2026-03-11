import {
  inject,
  provide,
  type InjectionKey,
} from "vue"

export type AffinoDataGridEnterpriseLicenseFeature =
  | "diagnostics"
  | "formulaRuntime"
  | "formulaPacks"
  | "performance"

type AffinoDataGridEnterpriseLicenseGrant = AffinoDataGridEnterpriseLicenseFeature | "all"
type AffinoDataGridEnterpriseLicenseTier = "trial" | "enterprise"

export interface AffinoDataGridEnterpriseLicenseClaims {
  version: 1
  tier: AffinoDataGridEnterpriseLicenseTier
  customer: string
  expiresAt: string
  features: readonly AffinoDataGridEnterpriseLicenseGrant[]
  checksum: string
}

export interface ResolvedAffinoDataGridEnterpriseLicense {
  status: "missing" | "invalid" | "expired" | "valid"
  source: "none" | "prop" | "provider"
  key: string | null
  claims: AffinoDataGridEnterpriseLicenseClaims | null
  reason: string | null
}

export interface AffinoDataGridEnterpriseLicenseSummary {
  status: ResolvedAffinoDataGridEnterpriseLicense["status"]
  statusLabel: string
  sourceLabel: string
  tier: AffinoDataGridEnterpriseLicenseTier | null
  tierLabel: string
  customer: string | null
  expiresAt: string | null
  daysRemaining: number | null
  featureLabel: string
  isTrial: boolean
  isExpiringSoon: boolean
  isScoped: boolean
}

export interface AffinoDataGridEnterpriseBlockedFeature {
  feature: AffinoDataGridEnterpriseLicenseFeature
  reason: string
}

export interface CreateAffinoDataGridEnterpriseLicenseOptions {
  tier?: AffinoDataGridEnterpriseLicenseTier
  customer: string
  expiresAt: string
  features?: readonly AffinoDataGridEnterpriseLicenseGrant[]
}

const AFFINO_DATAGRID_ENTERPRISE_LICENSE_PREFIX = "affino-dg-v1"
const AFFINO_DATAGRID_ENTERPRISE_LICENSE_SALT = "affino-dg-enterprise-2026"
const VALID_FEATURES = new Set<AffinoDataGridEnterpriseLicenseGrant>([
  "all",
  "diagnostics",
  "formulaRuntime",
  "formulaPacks",
  "performance",
])
const affinoDataGridEnterpriseLicenseKey: InjectionKey<string | undefined> = Symbol(
  "affinoDataGridEnterpriseLicense",
)

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function checksumForPayload(payload: string): string {
  return fnv1a32(`${payload}|${AFFINO_DATAGRID_ENTERPRISE_LICENSE_SALT}`)
    .toString(36)
    .toUpperCase()
    .padStart(7, "0")
}

function normalizeCustomer(customer: string): string {
  return customer
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeFeatureList(
  features: readonly AffinoDataGridEnterpriseLicenseGrant[] | undefined,
): readonly AffinoDataGridEnterpriseLicenseGrant[] {
  const source: readonly AffinoDataGridEnterpriseLicenseGrant[] =
    features && features.length > 0
      ? features
      : ["all"]
  const normalized = new Set<AffinoDataGridEnterpriseLicenseGrant>()

  for (const feature of source) {
    if (VALID_FEATURES.has(feature)) {
      normalized.add(feature)
    }
  }

  return normalized.size > 0
    ? Array.from(normalized)
    : ["all"]
}

function buildLicensePayload(input: CreateAffinoDataGridEnterpriseLicenseOptions): string {
  const tier = input.tier ?? "enterprise"
  const customer = normalizeCustomer(input.customer)
  const features = normalizeFeatureList(input.features)
  return [
    AFFINO_DATAGRID_ENTERPRISE_LICENSE_PREFIX,
    tier,
    customer,
    input.expiresAt,
    features.join(","),
  ].join(":")
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isExpired(expiresAt: string): boolean {
  if (!isIsoDate(expiresAt)) {
    return true
  }
  const expiry = Date.parse(`${expiresAt}T23:59:59.999Z`)
  if (!Number.isFinite(expiry)) {
    return true
  }
  return Date.now() > expiry
}

function getDaysRemaining(expiresAt: string): number | null {
  if (!isIsoDate(expiresAt)) {
    return null
  }
  const expiry = Date.parse(`${expiresAt}T23:59:59.999Z`)
  if (!Number.isFinite(expiry)) {
    return null
  }
  return Math.max(0, Math.ceil((expiry - Date.now()) / 86_400_000))
}

function parseLicenseClaims(key: string): AffinoDataGridEnterpriseLicenseClaims | null {
  const trimmed = key.trim()
  if (trimmed.length === 0) {
    return null
  }

  const segments = trimmed.split(":")
  if (segments.length !== 6) {
    return null
  }

  const [prefix, tier, customer, expiresAt, featuresRaw, checksum] = segments as [
    string,
    string,
    string,
    string,
    string,
    string,
  ]
  if (prefix !== AFFINO_DATAGRID_ENTERPRISE_LICENSE_PREFIX) {
    return null
  }
  if (tier !== "trial" && tier !== "enterprise") {
    return null
  }
  if (!customer || normalizeCustomer(customer).length === 0) {
    return null
  }
  if (!isIsoDate(expiresAt)) {
    return null
  }

  const features = featuresRaw
    .split(",")
    .map(entry => entry.trim())
    .filter((entry): entry is AffinoDataGridEnterpriseLicenseGrant => VALID_FEATURES.has(entry as AffinoDataGridEnterpriseLicenseGrant))

  const normalizedChecksum = checksum.trim().toUpperCase()

  if (features.length === 0) {
    return null
  }

  const payload = [prefix, tier, customer, expiresAt, features.join(",")].join(":")
  if (checksumForPayload(payload) !== normalizedChecksum) {
    return null
  }

  return {
    version: 1,
    tier,
    customer,
    expiresAt,
    features,
    checksum: normalizedChecksum,
  }
}

export function createAffinoDataGridEnterpriseLicenseKey(
  input: CreateAffinoDataGridEnterpriseLicenseOptions,
): string {
  const payload = buildLicensePayload(input)
  return `${payload}:${checksumForPayload(payload)}`
}

export function provideAffinoDataGridEnterpriseLicense(licenseKey: string): void {
  provide(affinoDataGridEnterpriseLicenseKey, licenseKey)
}

export function useAffinoDataGridEnterpriseLicenseKey(): string | undefined {
  return inject(affinoDataGridEnterpriseLicenseKey, undefined)
}

export function resolveAffinoDataGridEnterpriseLicense(
  input: string | null | undefined,
  source: "prop" | "provider" | "none",
): ResolvedAffinoDataGridEnterpriseLicense {
  const key = typeof input === "string" ? input.trim() : ""
  if (key.length === 0) {
    return {
      status: "missing",
      source,
      key: null,
      claims: null,
      reason: "license-missing",
    }
  }

  const claims = parseLicenseClaims(key)
  if (!claims) {
    return {
      status: "invalid",
      source,
      key,
      claims: null,
      reason: "license-invalid",
    }
  }

  if (isExpired(claims.expiresAt)) {
    return {
      status: "expired",
      source,
      key,
      claims,
      reason: "license-expired",
    }
  }

  return {
    status: "valid",
    source,
    key,
    claims,
    reason: null,
  }
}

export function hasAffinoDataGridEnterpriseLicenseFeature(
  license: ResolvedAffinoDataGridEnterpriseLicense,
  feature: AffinoDataGridEnterpriseLicenseFeature,
): boolean {
  if (license.status !== "valid" || !license.claims) {
    return false
  }
  return license.claims.features.includes("all") || license.claims.features.includes(feature)
}

export function summarizeAffinoDataGridEnterpriseLicense(
  license: ResolvedAffinoDataGridEnterpriseLicense,
): AffinoDataGridEnterpriseLicenseSummary {
  const claims = license.claims
  const daysRemaining = claims ? getDaysRemaining(claims.expiresAt) : null
  const isTrial = claims?.tier === "trial" && license.status === "valid"
  const isScoped = !!claims
    && !claims.features.includes("all")
  const featureLabel = !claims
    ? "No feature claims"
    : (
      claims.features.includes("all")
        ? "All enterprise features"
        : claims.features.join(", ")
    )

  let statusLabel = "Missing"
  if (license.status === "invalid") {
    statusLabel = "Invalid"
  } else if (license.status === "expired") {
    statusLabel = "Expired"
  } else if (license.status === "valid") {
    statusLabel = isTrial ? "Trial active" : "Enterprise active"
  }

  return {
    status: license.status,
    statusLabel,
    sourceLabel:
      license.source === "prop"
        ? "DataGrid prop"
        : (
          license.source === "provider"
            ? "App provider"
            : "No license"
        ),
    tier: claims?.tier ?? null,
    tierLabel:
      claims?.tier === "trial"
        ? "Trial"
        : (
          claims?.tier === "enterprise"
            ? "Enterprise"
            : "No tier"
        ),
    customer: claims?.customer ?? null,
    expiresAt: claims?.expiresAt ?? null,
    daysRemaining,
    featureLabel,
    isTrial,
    isExpiringSoon: daysRemaining !== null && daysRemaining <= 14,
    isScoped,
  }
}

export function explainAffinoDataGridEnterpriseLicenseFailure(
  license: ResolvedAffinoDataGridEnterpriseLicense,
  feature: AffinoDataGridEnterpriseLicenseFeature,
): string {
  if (license.status === "missing") {
    return `Enterprise feature "${feature}" requires a valid licenseKey.`
  }
  if (license.status === "invalid") {
    return `Enterprise feature "${feature}" is disabled because the licenseKey is invalid.`
  }
  if (license.status === "expired") {
    return `Enterprise feature "${feature}" is disabled because the licenseKey expired on ${license.claims?.expiresAt ?? "unknown date"}.`
  }
  return `Enterprise feature "${feature}" is not included in the current licenseKey.`
}
