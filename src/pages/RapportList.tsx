import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useVurderinger, useShelters } from '@/hooks/useShelters'
import AppLayout from '@/components/layout/AppLayout'
import { TableSkeleton } from '@/components/ui/Skeleton'
import {
  FileText,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Building2,
} from 'lucide-react'
import { groupReportsByStatus } from '@/lib/reportStatus'
import type { ReportStatusGroup } from '@/lib/reportStatus'
import {
  sortReports,
  shelterLabel,
  type ReportSortColumn,
  type ReportSortState,
} from '@/lib/reportSort'
import type { Shelter } from '@/types/database.types'
import { cn } from '@/lib/utils'

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('nb-NO') : '—'

const pluralize = (count: number) => `${count} rapport${count === 1 ? '' : 'er'}`

function SortableHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string
  column: ReportSortColumn
  sort: ReportSortState | null
  onSort: (column: ReportSortColumn) => void
}) {
  const active = sort?.column === column
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-gray-700',
          active && 'text-gray-700',
        )}
      >
        {label}
        {active ? (
          sort!.direction === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300" />
        )}
      </button>
    </th>
  )
}

function ReportSection({
  title,
  groups,
  shelterMap,
  showShelter,
  emptyText,
}: {
  title: string
  groups: ReportStatusGroup[]
  shelterMap: Map<string, Shelter>
  showShelter: boolean
  emptyText: string
}) {
  const [sort, setSort] = useState<ReportSortState | null>(null)
  const total = groups.reduce((sum, group) => sum + group.reports.length, 0)
  const columnCount = showShelter ? 4 : 3

  const toggleSort = (column: ReportSortColumn) =>
    setSort((prev) =>
      prev?.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' },
    )

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <span className="text-sm text-gray-500">{pluralize(total)}</span>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {groups.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{emptyText}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortableHeader label="Rapport-ID" column="id" sort={sort} onSort={toggleSort} />
                  {showShelter && (
                    <SortableHeader
                      label="Tilfluktsrom"
                      column="shelter"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  )}
                  <SortableHeader
                    label="Kontrolldato"
                    column="kontrolldato"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <th scope="col" className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.key}>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={columnCount} className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${group.badgeClass}`}
                          >
                            {group.label}
                          </span>
                          <span className="text-sm text-gray-500">
                            {pluralize(group.reports.length)}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {sortReports(group.reports, sort, shelterMap).map((report) => {
                      const shelter = report.tilfluktsrom
                        ? shelterMap.get(report.tilfluktsrom)
                        : undefined
                      return (
                        <tr
                          key={report.id}
                          className="border-t border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-6 py-4">
                            <Link
                              to={`/inspeksjonsrapporter/${report.id}`}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              Rapport #{report.id}
                            </Link>
                          </td>
                          {showShelter && (
                            <td className="px-6 py-4">
                              {report.tilfluktsrom ? (
                                shelter ? (
                                  <Link
                                    to={`/tilfluktsrom/${shelter.id}`}
                                    className="inline-flex items-center gap-1 text-gray-700 hover:underline"
                                  >
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                    {shelterLabel(shelter)}
                                  </Link>
                                ) : (
                                  <span className="text-gray-500">{report.tilfluktsrom}</span>
                                )
                              ) : (
                                <span className="text-gray-400">Ikke tilknyttet</span>
                              )}
                            </td>
                          )}
                          <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                            {formatDate(report.kontrolldato)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              to={`/inspeksjonsrapporter/${report.id}`}
                              className="text-gray-400 hover:text-gray-600"
                              aria-label={`Åpne rapport ${report.id}`}
                            >
                              <ChevronRight className="w-5 h-5" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default function RapportList() {
  const { data: reports, isLoading, error } = useVurderinger()
  const { data: shelters } = useShelters()

  const shelterMap = useMemo(
    () => new Map((shelters ?? []).map((shelter) => [shelter.id, shelter])),
    [shelters],
  )

  const { attachedGroups, unattachedGroups } = useMemo(() => {
    const all = reports ?? []
    return {
      attachedGroups: groupReportsByStatus(all.filter((r) => r.tilfluktsrom)),
      unattachedGroups: groupReportsByStatus(all.filter((r) => !r.tilfluktsrom)),
    }
  }, [reports])

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Inspeksjonsrapporter</h1>
          <p className="text-gray-600 mt-1">
            Oversikt over alle inspeksjonsrapporter, gruppert etter status.
          </p>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-red-600">
            Feil ved lasting av rapporter: {(error as Error).message}
          </div>
        ) : (
          <>
            <ReportSection
              title="Tilknyttet tilfluktsrom"
              groups={attachedGroups}
              shelterMap={shelterMap}
              showShelter
              emptyText="Ingen rapporter er knyttet til et tilfluktsrom."
            />
            <ReportSection
              title="Uten tilfluktsrom"
              groups={unattachedGroups}
              shelterMap={shelterMap}
              showShelter={false}
              emptyText="Ingen rapporter uten tilfluktsrom."
            />
          </>
        )}
      </div>
    </AppLayout>
  )
}
