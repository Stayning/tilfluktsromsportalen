import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShelters } from '@/hooks/useShelters'
import type { Shelter } from '@/types/database.types'
import AppLayout from '@/components/layout/AppLayout'
import { TableSkeleton } from '@/components/ui/Skeleton'
import {
  Search,
  Plus,
  Building2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react'

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('nb-NO') : '—'

type SortKey = 'navn' | 'matrikkel' | 'kapasitet' | 'registrert' | 'sist_endret'
type SortDir = 'asc' | 'desc'

// Comparable value per column. Return null for "missing" so those rows always
// sort last regardless of direction. Dates become timestamps for numeric compare.
const sortAccessors: Record<SortKey, (s: Shelter) => string | number | null> = {
  navn: (s) => (s.alias || s.kundenavn || s.id).toLowerCase(),
  matrikkel: (s) => s.matrikkel?.toLowerCase() ?? null,
  kapasitet: (s) => s.plasser,
  registrert: (s) => (s.created_at ? new Date(s.created_at).getTime() : null),
  sist_endret: (s) => (s.updated_at ? new Date(s.updated_at).getTime() : null),
}

const columns: { key: SortKey; label: string }[] = [
  { key: 'navn', label: 'Navn' },
  { key: 'matrikkel', label: 'Matrikkel' },
  { key: 'kapasitet', label: 'Kapasitet' },
  { key: 'registrert', label: 'Registrert' },
  { key: 'sist_endret', label: 'Sist endret' },
]

export default function ShelterList() {
  const [search, setSearch] = useState('')
  // Default matches the query's server-side order: newest registered first.
  const [sortKey, setSortKey] = useState<SortKey>('registrert')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data: shelters, isLoading, error } = useShelters({
    search: search || undefined,
  })

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Text reads best A→Z; numbers and dates read best highest/newest first.
      setSortDir(key === 'navn' || key === 'matrikkel' ? 'asc' : 'desc')
    }
  }

  const sortedShelters = useMemo(() => {
    if (!shelters) return []
    const accessor = sortAccessors[sortKey]
    const dir = sortDir === 'asc' ? 1 : -1
    return [...shelters].sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      if (av === null && bv === null) return 0
      if (av === null) return 1 // missing values always last
      if (bv === null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'nb') * dir
    })
  }, [shelters, sortKey, sortDir])

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tilfluktsrom</h1>
            <p className="text-gray-600 mt-1">
              Oversikt over alle registrerte tilfluktsrom, inspeksjoner og vedlikeholdsstatus.
            </p>
          </div>
          <Link
            to="/tilfluktsrom/ny"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Registrer nytt tilfluktsrom
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk etter alias, matrikkel..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {error ? (
            <div className="p-8 text-center text-red-600">
              Feil ved lasting av tilfluktsrom: {(error as Error).message}
            </div>
          ) : !shelters || shelters.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Ingen tilfluktsrom funnet.</p>
              <Link
                to="/tilfluktsrom/ny"
                className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:underline"
              >
                <Plus className="w-4 h-4" />
                Registrer det første tilfluktsrommet
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {columns.map((col) => {
                      const active = sortKey === col.key
                      return (
                        <th
                          key={col.key}
                          aria-sort={
                            active
                              ? sortDir === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                          }
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className="group inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-700"
                          >
                            {col.label}
                            {active ? (
                              sortDir === 'asc' ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400" />
                            )}
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedShelters.map((shelter) => (
                    <tr key={shelter.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link
                          to={`/tilfluktsrom/${shelter.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {shelter.alias || shelter.kundenavn || shelter.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {shelter.matrikkel || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {shelter.plasser ? `${shelter.plasser} pers.` : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(shelter.created_at)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(shelter.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination placeholder */}
          {shelters && shelters.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
              <span>
                Viser {shelters.length} tilfluktsrom
              </span>
            </div>
          )}
        </div>
        )}
      </div>
    </AppLayout>
  )
}
