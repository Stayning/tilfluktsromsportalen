import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import { TableSkeleton } from '@/components/ui/Skeleton'
import {
  useCustomer,
  useCustomerMembers,
  useCustomerShelters,
} from '@/hooks/useShelters'
import { ChevronLeft, Building2, Users, Briefcase, ChevronRight } from 'lucide-react'

interface CustomerUserSummary {
  userId: string
  name: string
  email?: string | null
  phone?: string | null
  activeCount: number
  lockedCount: number
  shelterNames: string[]
}

const buildShelterListPreview = (names: string[]) => {
  if (names.length === 0) return '-'
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const customerId = id ? Number(id) : NaN

  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
  } = useCustomer(Number.isNaN(customerId) ? undefined : customerId)

  const customerNumber = customer?.nummer ?? customer?.id ?? null
  const customerName = customer?.navn ?? null

  const {
    data: shelters,
    isLoading: sheltersLoading,
    error: sheltersError,
  } = useCustomerShelters(customerNumber, customerName)

  const shelterIds = useMemo(
    () => (shelters ?? []).map((shelter) => shelter.id).sort(),
    [shelters]
  )

  const {
    data: memberships,
    isLoading: membersLoading,
    error: membersError,
  } = useCustomerMembers(shelterIds)

  const shelterMap = useMemo(() => {
    const map = new Map<string, { alias?: string | null; kundenavn?: string | null }>()
    shelters?.forEach((shelter) => {
      map.set(shelter.id, shelter)
    })
    return map
  }, [shelters])

  const userSummaries = useMemo<CustomerUserSummary[]>(() => {
    if (!memberships) return []

    const byUser = new Map<string, {
      summary: CustomerUserSummary
      shelterIds: Set<string>
    }>()

    memberships.forEach((membership) => {
      const profile = membership.profile
      if (!profile) return

      const userId = profile.id
      const existing = byUser.get(userId)
      if (!existing) {
        const displayName = [profile.first_name, profile.last_name]
          .filter(Boolean)
          .join(' ') || 'Ukjent bruker'
        byUser.set(userId, {
          summary: {
            userId,
            name: displayName,
            email: profile.email,
            phone: profile.phone,
            activeCount: 0,
            lockedCount: 0,
            shelterNames: [],
          },
          shelterIds: new Set(),
        })
      }

      const entry = byUser.get(userId)
      if (!entry) return

      if (membership.is_active) {
        entry.summary.activeCount += 1
      } else {
        entry.summary.lockedCount += 1
      }

      if (membership.shelter_id) {
        entry.shelterIds.add(membership.shelter_id)
      }
    })

    return Array.from(byUser.values())
      .map((entry) => ({
        ...entry.summary,
        shelterNames: Array.from(entry.shelterIds)
          .map((sid) => {
            const s = shelterMap.get(sid)
            return (s?.alias || s?.kundenavn) ?? sid
          })
          .sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [memberships, shelterMap])

  if (customerLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-500">Laster kunde...</div>
        </div>
      </AppLayout>
    )
  }

  if (customerError || !customer) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-red-600">
            {customerError ? (customerError as Error).message : 'Kunde ikke funnet'}
          </div>
          <div className="text-center mt-4">
            <Link to="/admin/kunder" className="text-blue-600 hover:underline">
              ← Tilbake til kunder
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  const statusLabel = customer.aktiv === false ? 'Inaktiv' : 'Aktiv'

  const totalShelters = shelters?.length ?? 0
  const totalUsers = userSummaries.length
  const lockedMemberships = memberships?.filter((membership) => !membership.is_active).length ?? 0
  const usersLoading = sheltersLoading || membersLoading

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <nav className="mb-4">
          <Link
            to="/admin/kunder"
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Kunder
          </Link>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{customer.navn}</h1>
              {customer.aktiv === false ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {statusLabel}
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {statusLabel}
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1 flex flex-wrap items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Kundenr. {customer.nummer ?? customer.id}
              {customer.orgnr && (
                <span className="text-gray-400">• Org.nr {customer.orgnr}</span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Tilfluktsrom</p>
            <p className="text-2xl font-bold text-gray-900">{totalShelters}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Brukere med tilgang</p>
            <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Låste medlemskap</p>
            <p className="text-2xl font-bold text-gray-900">{lockedMemberships}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Tilfluktsrom
              </h2>
              <span className="text-sm text-gray-500">{totalShelters} totalt</span>
            </div>
            <div className="p-4">
              {sheltersLoading ? (
                <TableSkeleton rows={4} columns={3} />
              ) : sheltersError ? (
                <div className="text-center text-red-600">
                  {(sheltersError as Error).message}
                </div>
              ) : !shelters || shelters.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  Ingen tilfluktsrom koblet til kunden.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Navn
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Matrikkel
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Handling
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {shelters.map((shelter) => (
                        <tr key={shelter.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {shelter.alias || shelter.kundenavn}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {shelter.matrikkel || '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/tilfluktsrom/${shelter.id}`}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Brukere med tilgang
              </h2>
              <span className="text-sm text-gray-500">{totalUsers} totalt</span>
            </div>
            <div className="p-4">
              {usersLoading ? (
                <TableSkeleton rows={4} columns={4} />
              ) : membersError ? (
                <div className="text-center text-red-600">
                  {(membersError as Error).message}
                </div>
              ) : !shelters || shelters.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  Ingen brukere fordi kunden mangler tilfluktsrom.
                </div>
              ) : userSummaries.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  Ingen brukere med tilgang til kundens tilfluktsrom.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Bruker
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          E-post
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Telefon
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tilfluktsrom
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {userSummaries.map((user) => (
                        <tr key={user.userId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            {user.lockedCount > 0 && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                {user.lockedCount} låst
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {user.email || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {user.phone || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="text-gray-900">
                              {user.activeCount + user.lockedCount} tilfluktsrom
                            </div>
                            <div
                              className="text-xs text-gray-500"
                              title={user.shelterNames.join(', ')}
                            >
                              {buildShelterListPreview(user.shelterNames)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  )
}
