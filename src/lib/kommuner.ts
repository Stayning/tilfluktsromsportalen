import kommuner from '@/data/kommuner.json'

export type KommuneEntry = {
  code: string
  name: string
  status: string
}

export type KommuneOption = {
  value: string
  label: string
}

const kommuneEntries = (kommuner as KommuneEntry[]).filter(
  (entry) => entry.code && entry.name
)

const kommuneMap = new Map(kommuneEntries.map((entry) => [entry.code, entry]))

const activeKommuner = kommuneEntries.filter((entry) => entry.status === 'Gyldig')

export const kommuneOptions: KommuneOption[] = activeKommuner
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  .map((entry) => ({
    value: entry.code,
    label: entry.name,
  }))

const kommuneSearchIndex = kommuneEntries.map((entry) => ({
  code: entry.code,
  name: entry.name,
  nameLower: entry.name.toLowerCase(),
}))

export function getKommuneName(code: string | null | undefined) {
  if (!code) return null
  return kommuneMap.get(code)?.name ?? code
}

export function findKommuneCodesBySearch(term: string) {
  const normalized = term.trim().toLowerCase()
  if (!normalized) return []
  return kommuneSearchIndex
    .filter((entry) => entry.nameLower.includes(normalized))
    .map((entry) => entry.code)
}
