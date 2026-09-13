import type { Shelter, Vurdering } from '@/types/database.types'

export type ReportSortColumn = 'id' | 'shelter' | 'kontrolldato'
export type SortDirection = 'asc' | 'desc'

export interface ReportSortState {
  column: ReportSortColumn
  direction: SortDirection
}

export const shelterLabel = (shelter: Shelter) =>
  shelter.alias || shelter.kundenavn || shelter.id

// Display/sort label for the shelter a report is attached to. Falls back to the
// raw tilfluktsrom id when the shelter isn't loaded, and '' when unattached.
export const shelterLabelFor = (
  report: Vurdering,
  shelterMap: Map<string, Shelter>,
): string => {
  if (!report.tilfluktsrom) return ''
  const shelter = shelterMap.get(report.tilfluktsrom)
  return shelter ? shelterLabel(shelter) : report.tilfluktsrom
}

// Sort reports by the active column. Returns the input untouched when no sort is
// active. Rapport-ID and shelter use a numeric-aware locale compare (so "2" <
// "10"); missing kontrolldato values always sort last, regardless of direction.
export function sortReports(
  reports: Vurdering[],
  sort: ReportSortState | null,
  shelterMap: Map<string, Shelter>,
): Vurdering[] {
  if (!sort) return reports
  const dir = sort.direction === 'asc' ? 1 : -1

  return [...reports].sort((a, b) => {
    if (sort.column === 'kontrolldato') {
      const ta = a.kontrolldato ? new Date(a.kontrolldato).getTime() : null
      const tb = b.kontrolldato ? new Date(b.kontrolldato).getTime() : null
      if (ta === null && tb === null) return 0
      if (ta === null) return 1
      if (tb === null) return -1
      return (ta - tb) * dir
    }

    if (sort.column === 'shelter') {
      return (
        shelterLabelFor(a, shelterMap).localeCompare(
          shelterLabelFor(b, shelterMap),
          'nb',
          { numeric: true },
        ) * dir
      )
    }

    return a.id.localeCompare(b.id, 'nb', { numeric: true }) * dir
  })
}
