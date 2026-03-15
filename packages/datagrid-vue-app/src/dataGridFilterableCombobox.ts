export interface DataGridFilterableComboboxOption {
  label: string
  value: string
}

interface RankedComboboxOption {
  option: DataGridFilterableComboboxOption
  score: number
  originalIndex: number
}

const SCORE_EXACT_LABEL = 0
const SCORE_EXACT_VALUE = 1
const SCORE_PREFIX_LABEL = 2
const SCORE_PREFIX_VALUE = 3
const SCORE_WORD_PREFIX_LABEL = 4
const SCORE_WORD_PREFIX_VALUE = 5
const SCORE_CONTAINS_LABEL = 6
const SCORE_CONTAINS_VALUE = 7
const SCORE_NO_MATCH = 100

export function rankDataGridFilterableComboboxOptions(
  options: ReadonlyArray<DataGridFilterableComboboxOption>,
  query: string,
): DataGridFilterableComboboxOption[] {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery.length === 0) {
    return [...options]
  }

  const ranked = options
    .map<RankedComboboxOption>((option, originalIndex) => ({
      option,
      score: resolveOptionScore(option, normalizedQuery),
      originalIndex,
    }))
    .filter(entry => entry.score < SCORE_NO_MATCH)

  ranked.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score
    }
    const leftLabelLength = left.option.label.length
    const rightLabelLength = right.option.label.length
    if (leftLabelLength !== rightLabelLength) {
      return leftLabelLength - rightLabelLength
    }
    return left.originalIndex - right.originalIndex
  })

  return ranked.map(entry => entry.option)
}

function resolveOptionScore(
  option: DataGridFilterableComboboxOption,
  normalizedQuery: string,
): number {
  const normalizedLabel = normalizeSearchText(option.label)
  const normalizedValue = normalizeSearchText(option.value)

  if (normalizedLabel === normalizedQuery) {
    return SCORE_EXACT_LABEL
  }
  if (normalizedValue === normalizedQuery) {
    return SCORE_EXACT_VALUE
  }
  if (normalizedLabel.startsWith(normalizedQuery)) {
    return SCORE_PREFIX_LABEL
  }
  if (normalizedValue.startsWith(normalizedQuery)) {
    return SCORE_PREFIX_VALUE
  }
  if (hasWordPrefixMatch(normalizedLabel, normalizedQuery)) {
    return SCORE_WORD_PREFIX_LABEL
  }
  if (hasWordPrefixMatch(normalizedValue, normalizedQuery)) {
    return SCORE_WORD_PREFIX_VALUE
  }
  if (normalizedLabel.includes(normalizedQuery)) {
    return SCORE_CONTAINS_LABEL
  }
  if (normalizedValue.includes(normalizedQuery)) {
    return SCORE_CONTAINS_VALUE
  }
  return SCORE_NO_MATCH
}

function hasWordPrefixMatch(value: string, normalizedQuery: string): boolean {
  if (value.length === 0 || normalizedQuery.length === 0) {
    return false
  }
  return value
    .split(/[^a-z0-9]+/i)
    .some(token => token.length > 0 && token.startsWith(normalizedQuery))
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase()
}
