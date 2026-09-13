import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAddUserToShelter,
  useAllUsers,
  useDeleteUser,
  useShelters,
  useToggleMemberStatus,
  useUpdateUser,
  type UserWithMemberships,
} from '@/hooks/useShelters'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import PhoneInput from 'react-phone-number-input'
import { toDisplayPhone, samePhone, isValidPhoneNumber } from '@/lib/phone'
import 'react-phone-number-input/style.css'
import AppLayout from '@/components/layout/AppLayout'
import { TableSkeleton } from '@/components/ui/Skeleton'
import {
  Search,
  Users,
  Lock,
  Unlock,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ArrowUpDown,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'

type SortKey = 'name' | 'email' | 'phone' | 'shelters' | 'tos'

const hasPhone = (user: UserWithMemberships) =>
  typeof user.phone === 'string' && user.phone.trim().length > 0

const ERROR_MESSAGES: Record<string, string> = {
  last_admin: 'Kan ikke fjerne den siste administratoren.',
  cannot_delete_self: 'Du kan ikke slette din egen bruker.',
  not_admin: 'Du har ikke tilgang til denne handlingen.',
  missing_user_id: 'Mangler bruker-ID.',
  no_authorization: 'Du må være innlogget.',
  invalid_token: 'Økten er utløpt. Logg inn på nytt.',
  email_in_use: 'E-postadressen er allerede i bruk av en annen bruker.',
  phone_in_use: 'Telefonnummeret er allerede i bruk av en annen bruker.',
}

function friendlyError(message: string): string {
  return ERROR_MESSAGES[message] ?? message
}

export default function UserDirectory() {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  })
  const [addToShelterUser, setAddToShelterUser] = useState<UserWithMemberships | null>(null)
  const [editUser, setEditUser] = useState<UserWithMemberships | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserWithMemberships | null>(null)

  const { user: authUser } = useAuth()
  const { data: users, isLoading, error } = useAllUsers()
  const toggleStatus = useToggleMemberStatus()

  const toggleExpanded = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const filteredUsers = users?.filter((user) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.phone?.includes(searchTerm)
    )
  })

  const usersWithPhone = filteredUsers?.filter(hasPhone)
  const usersWithoutPhone = filteredUsers?.filter((user) => !hasPhone(user))

  const totalWithoutPhone = users?.filter((user) => !hasPhone(user)).length ?? 0

  const getDisplayName = (user: UserWithMemberships) => {
    const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
    return name || 'Ukjent'
  }

  const compareStrings = (a: string, b: string) =>
    a.localeCompare(b, 'nb', { sensitivity: 'base', numeric: true })

  const compareOptionalStrings = (a?: string | null, b?: string | null) => {
    if (!a && !b) return 0
    if (!a) return 1
    if (!b) return -1
    return compareStrings(a, b)
  }

  const compareOptionalDates = (a?: string | null, b?: string | null) => {
    if (!a && !b) return 0
    if (!a) return 1
    if (!b) return -1
    return new Date(a).getTime() - new Date(b).getTime()
  }

  const getShelterCount = (user: UserWithMemberships) =>
    user.memberships?.length ?? 0

  const sortUsers = (list: UserWithMemberships[] | undefined) =>
    list?.slice().sort((a, b) => {
      let result = 0
      switch (sortConfig.key) {
        case 'name':
          result = compareStrings(getDisplayName(a), getDisplayName(b))
          break
        case 'email':
          result = compareOptionalStrings(a.email, b.email)
          break
        case 'phone':
          result = compareOptionalStrings(a.phone, b.phone)
          break
        case 'shelters':
          result = getShelterCount(a) - getShelterCount(b)
          break
        case 'tos':
          result = compareOptionalDates(a.tos_accepted_at, b.tos_accepted_at)
          break
        default:
          result = 0
      }

      if (result === 0) {
        result = compareStrings(getDisplayName(a), getDisplayName(b))
      }

      return sortConfig.direction === 'asc' ? result : -result
    })

  const sortedUsersWithPhone = sortUsers(usersWithPhone)
  const sortedUsersWithoutPhone = sortUsers(usersWithoutPhone)

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        }
      }
      return { key, direction: 'asc' }
    })
  }

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400" />
    }

    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-gray-700" />
    ) : (
      <ChevronDown className="w-3 h-3 text-gray-700" />
    )
  }

  const getAriaSort = (key: SortKey) => {
    if (sortConfig.key !== key) return 'none'
    return sortConfig.direction === 'asc' ? 'ascending' : 'descending'
  }

  const { showToast } = useToast()

  const handleToggleStatus = async (memberId: string, currentStatus: boolean, userName: string) => {
    try {
      await toggleStatus.mutateAsync({
        memberId,
        isActive: !currentStatus,
      })
      showToast(
        currentStatus
          ? `${userName} sin tilgang er nå låst`
          : `${userName} sin tilgang er gjenopprettet`,
        currentStatus ? 'info' : 'success'
      )
    } catch (err) {
      showToast(`Kunne ikke oppdatere tilgang: ${(err as Error).message}`, 'error')
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Brukeroversikt
            </h1>
          </div>
          <TableSkeleton rows={8} columns={5} />
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-red-600">
            {(error as Error).message}
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Brukeroversikt
          </h1>
          <p className="text-gray-600 mt-1">
            Administrer alle brukere og deres tilfluktsromtilgang
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Søk etter navn, e-post eller telefon..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Totalt brukere</p>
            <p className="text-2xl font-bold text-gray-900">{users?.length || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Med tilfluktsromtilgang</p>
            <p className="text-2xl font-bold text-gray-900">
              {users?.filter((user) => (user.memberships?.length ?? 0) > 0).length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Låste medlemskap</p>
            <p className="text-2xl font-bold text-gray-900">
              {users?.reduce((acc, user) => {
                const lockedCount =
                  user.memberships?.filter((membership) => !membership.is_active)?.length ?? 0
                return acc + lockedCount
              }, 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Uten telefonnummer</p>
            <p className="text-2xl font-bold text-gray-900">{totalWithoutPhone}</p>
          </div>
        </div>

        {/* User List — with phone */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  aria-sort={getAriaSort('name')}
                >
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="flex w-full items-center gap-2 text-left cursor-pointer px-6 py-3"
                  >
                    <span>Bruker</span>
                    {getSortIcon('name')}
                  </button>
                </th>
                <th
                  className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  aria-sort={getAriaSort('email')}
                >
                  <button
                    type="button"
                    onClick={() => handleSort('email')}
                    className="flex w-full items-center gap-2 text-left cursor-pointer px-6 py-3"
                  >
                    <span>E-post</span>
                    {getSortIcon('email')}
                  </button>
                </th>
                <th
                  className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  aria-sort={getAriaSort('phone')}
                >
                  <button
                    type="button"
                    onClick={() => handleSort('phone')}
                    className="flex w-full items-center gap-2 text-left cursor-pointer px-6 py-3"
                  >
                    <span>Telefon</span>
                    {getSortIcon('phone')}
                  </button>
                </th>
                <th
                  className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  aria-sort={getAriaSort('shelters')}
                >
                  <button
                    type="button"
                    onClick={() => handleSort('shelters')}
                    className="flex w-full items-center gap-2 text-left cursor-pointer px-6 py-3"
                  >
                    <span>Tilfluktsrom</span>
                    {getSortIcon('shelters')}
                  </button>
                </th>
                <th
                  className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  aria-sort={getAriaSort('tos')}
                >
                  <button
                    type="button"
                    onClick={() => handleSort('tos')}
                    className="flex w-full items-center gap-2 text-left cursor-pointer px-6 py-3"
                  >
                    <span>Vilkår godtatt</span>
                    {getSortIcon('tos')}
                  </button>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="sr-only">Handling</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedUsersWithPhone?.map((user) => {
                const isExpanded = expandedUsers.has(user.id)
                const hasMemberships = user.memberships && user.memberships.length > 0
                const isInspector = !!user.is_admin
                const activeMemberships =
                  user.memberships?.filter((membership) => membership.is_active) ?? []
                const lockedMemberships =
                  user.memberships?.filter((membership) => !membership.is_active) ?? []

                return (
                  <Fragment key={user.id}>
                    <tr
                      className={`hover:bg-gray-50 ${hasMemberships ? 'cursor-pointer' : ''}`}
                      onClick={() => hasMemberships && toggleExpanded(user.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {hasMemberships && (
                            isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )
                          )}
                          {!hasMemberships && <span className="w-4" />}
                          <span className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </span>
                          {isInspector && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Inspektør
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{user.email || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{user.phone || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {activeMemberships.length} aktive
                        </span>
                        {lockedMemberships.length > 0 && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {lockedMemberships.length} låst
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.tos_accepted_at ? (
                          <span className="text-green-600">
                            {new Date(user.tos_accepted_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditUser(user)
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
                            title="Rediger bruker"
                          >
                            <Pencil className="w-4 h-4" />
                            <span>Rediger</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setAddToShelterUser(user)
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                            title="Legg til i tilfluktsrom"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Legg til i tilfluktsrom</span>
                          </button>
                          {authUser?.id !== user.id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteUser(user)
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                              title="Slett bruker"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Slett</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded membership details */}
                    {isExpanded &&
                      user.memberships?.map((membership) => (
                        <tr
                          key={membership.id}
                          className="bg-gray-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <td className="px-6 py-3 pl-12" colSpan={3}>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <Link
                                to={`/tilfluktsrom/${membership.shelter_id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {membership.shelter?.alias || membership.shelter?.kundenavn || membership.shelter?.id || 'Ukjent tilfluktsrom'}
                              </Link>
                              {membership.inviter && (
                                <span className="text-sm text-gray-500">
                                  (invitert av {membership.inviter.first_name} {membership.inviter.last_name})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            {membership.is_active ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Aktiv
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Låst
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <button
                              onClick={() =>
                                handleToggleStatus(
                                  membership.id,
                                  membership.is_active,
                                  `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Bruker'
                                )
                              }
                              disabled={toggleStatus.isPending}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded text-sm ${
                                membership.is_active
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-green-600 hover:bg-green-50'
                              } disabled:opacity-50`}
                            >
                              {membership.is_active ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  Lås
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  Lås opp
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-3" />
                        </tr>
                      ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {sortedUsersWithPhone?.length === 0 && (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Ingen brukere funnet.</p>
            </div>
          )}
        </div>

        {/* User List — without phone */}
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Ugyldige brukere uten telefonnummer</h2>
          <p className="text-sm text-gray-500 mt-1">
            Disse brukerne mangler et registrert telefonnummer og bør følges opp.
          </p>
        </div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bruker
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  E-post
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tilfluktsrom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vilkår godtatt
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="sr-only">Handling</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedUsersWithoutPhone?.map((user) => {
                const isExpanded = expandedUsers.has(user.id)
                const hasMemberships = user.memberships && user.memberships.length > 0
                const isInspector = !!user.is_admin
                const activeMemberships =
                  user.memberships?.filter((membership) => membership.is_active) ?? []
                const lockedMemberships =
                  user.memberships?.filter((membership) => !membership.is_active) ?? []

                return (
                  <Fragment key={user.id}>
                    <tr
                      className={`hover:bg-gray-50 ${hasMemberships ? 'cursor-pointer' : ''}`}
                      onClick={() => hasMemberships && toggleExpanded(user.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {hasMemberships && (
                            isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )
                          )}
                          {!hasMemberships && <span className="w-4" />}
                          <span className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </span>
                          {isInspector && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Inspektør
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{user.email || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {activeMemberships.length} aktive
                        </span>
                        {lockedMemberships.length > 0 && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {lockedMemberships.length} låst
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.tos_accepted_at ? (
                          <span className="text-green-600">
                            {new Date(user.tos_accepted_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditUser(user)
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
                            title="Rediger bruker"
                          >
                            <Pencil className="w-4 h-4" />
                            <span>Rediger</span>
                          </button>
                          {authUser?.id !== user.id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteUser(user)
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                              title="Slett bruker"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Slett</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded &&
                      user.memberships?.map((membership) => (
                        <tr
                          key={membership.id}
                          className="bg-gray-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <td className="px-6 py-3 pl-12" colSpan={2}>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <Link
                                to={`/tilfluktsrom/${membership.shelter_id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {membership.shelter?.alias || membership.shelter?.kundenavn || membership.shelter?.id || 'Ukjent tilfluktsrom'}
                              </Link>
                              {membership.inviter && (
                                <span className="text-sm text-gray-500">
                                  (invitert av {membership.inviter.first_name} {membership.inviter.last_name})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            {membership.is_active ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Aktiv
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Låst
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <button
                              onClick={() =>
                                handleToggleStatus(
                                  membership.id,
                                  membership.is_active,
                                  `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Bruker'
                                )
                              }
                              disabled={toggleStatus.isPending}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded text-sm ${
                                membership.is_active
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-green-600 hover:bg-green-50'
                              } disabled:opacity-50`}
                            >
                              {membership.is_active ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  Lås
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  Lås opp
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-3" />
                        </tr>
                      ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {sortedUsersWithoutPhone?.length === 0 && (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Alle brukere har telefonnummer registrert.</p>
            </div>
          )}
        </div>
      </div>

      {addToShelterUser && (
        <AddToShelterModal
          user={addToShelterUser}
          onClose={() => setAddToShelterUser(null)}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          isSelf={authUser?.id === editUser.id}
          onClose={() => setEditUser(null)}
        />
      )}

      {deleteUser && (
        <DeleteUserDialog user={deleteUser} onClose={() => setDeleteUser(null)} />
      )}
    </AppLayout>
  )
}

function AddToShelterModal({
  user,
  onClose,
}: {
  user: UserWithMemberships
  onClose: () => void
}) {
  const [selectedShelterId, setSelectedShelterId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data: shelters, isLoading: sheltersLoading } = useShelters()
  const addMutation = useAddUserToShelter()
  const { showToast } = useToast()

  const userLabel =
    `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Brukeren'

  const memberShelterIds = useMemo(() => {
    const ids = new Set<string>()
    user.memberships?.forEach((membership) => {
      if (membership.shelter_id) ids.add(membership.shelter_id)
    })
    return ids
  }, [user.memberships])

  const availableShelters = useMemo(() => {
    const list = (shelters ?? []).filter((s) => !memberShelterIds.has(s.id))
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter((s) => {
      return (
        s.alias?.toLowerCase().includes(q) ||
        s.kundenavn?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
      )
    })
  }, [shelters, memberShelterIds, search])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedShelterId) {
      setError('Velg et tilfluktsrom')
      return
    }

    const selected = shelters?.find((s) => s.id === selectedShelterId)
    const shelterLabel =
      selected?.alias || selected?.kundenavn || selected?.id || 'tilfluktsrommet'

    try {
      await addMutation.mutateAsync({
        shelterId: selectedShelterId,
        userId: user.id,
      })
      showToast(`${userLabel} har fått tilgang til ${shelterLabel}`, 'success')
      onClose()
    } catch (err) {
      const message = (err as Error).message
      if (message.includes('duplicate') || message.includes('unique')) {
        setError('Brukeren er allerede medlem')
        showToast('Brukeren er allerede medlem', 'error')
      } else if (message.includes('permission') || message.includes('policy')) {
        setError('Du har ikke tillatelse til å legge til medlemmer')
        showToast('Du har ikke tillatelse til å legge til medlemmer', 'error')
      } else {
        setError(message)
        showToast(`Kunne ikke legge til bruker: ${message}`, 'error')
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Legg til i tilfluktsrom
        </h2>
        <p className="text-sm text-gray-500 mb-4">{userLabel}</p>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Søk etter tilfluktsrom
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Alias, kunde eller ID..."
            className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Velg tilfluktsrom
          </label>
          <select
            value={selectedShelterId}
            onChange={(e) => setSelectedShelterId(e.target.value)}
            disabled={sheltersLoading}
            size={Math.min(8, Math.max(3, availableShelters.length))}
            className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableShelters.length === 0 && (
              <option value="" disabled>
                {sheltersLoading
                  ? 'Laster...'
                  : memberShelterIds.size > 0 && (shelters?.length ?? 0) > 0
                  ? 'Brukeren har allerede tilgang til alle tilgjengelige tilfluktsrom'
                  : 'Ingen tilfluktsrom funnet'}
              </option>
            )}
            {availableShelters.map((shelter) => (
              <option key={shelter.id} value={shelter.id}>
                {shelter.alias || shelter.kundenavn || shelter.id}
              </option>
            ))}
          </select>

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || !selectedShelterId}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {addMutation.isPending ? 'Legger til...' : 'Legg til'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditUserModal({
  user,
  isSelf,
  onClose,
}: {
  user: UserWithMemberships
  isSelf: boolean
  onClose: () => void
}) {
  const [firstName, setFirstName] = useState(user.first_name ?? '')
  const [lastName, setLastName] = useState(user.last_name ?? '')
  const [phone, setPhone] = useState<string | undefined>(toDisplayPhone(user.phone))
  const [email, setEmail] = useState(user.email ?? '')
  const [isAdmin, setIsAdmin] = useState(!!user.is_admin)
  const [error, setError] = useState<string | null>(null)

  const updateUser = useUpdateUser()
  const { showToast } = useToast()
  const { refreshProfile } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const phoneChanged = !samePhone(phone, user.phone)
    if (phoneChanged && phone && !isValidPhoneNumber(phone)) {
      setError('Ugyldig telefonnummer')
      return
    }

    // Only send a credential (phone/email) when it actually changed, so a
    // name-only edit never re-applies the existing email/phone — re-applying can
    // trip a uniqueness constraint if another account already holds that value.
    const emailChanged = email.trim() !== (user.email ?? '').trim()

    try {
      await updateUser.mutateAsync({
        userId: user.id,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phoneChanged && phone && isValidPhoneNumber(phone) ? phone.trim() : undefined,
        email: emailChanged ? email.trim() || null : undefined,
        is_admin: isAdmin,
      })
      if (isSelf) await refreshProfile()
      showToast('Bruker oppdatert', 'success')
      onClose()
    } catch (err) {
      const msg = friendlyError((err as Error).message)
      setError(msg)
      showToast(msg, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rediger bruker</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornavn</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Etternavn</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefonnummer</label>
            <PhoneInput
              international
              defaultCountry="NO"
              value={phone}
              onChange={setPhone}
              className="phone-input-container"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="rounded border-gray-300"
            />
            Inspektør (administrator)
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={updateUser.isPending}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {updateUser.isPending ? 'Lagrer...' : 'Lagre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteUserDialog({
  user,
  onClose,
}: {
  user: UserWithMemberships
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const deleteUser = useDeleteUser()
  const { showToast } = useToast()

  const label =
    `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
    user.phone ||
    user.email ||
    'brukeren'

  const handleDelete = async () => {
    setError(null)
    try {
      const result = await deleteUser.mutateAsync(user.id)
      const r = result.reassigned
      const moved = r.shelters + r.documents + r.invites + r.memberships
      showToast(
        moved > 0
          ? `Bruker slettet. ${moved} ressurs(er) overført til deg.`
          : 'Bruker slettet.',
        'success',
      )
      onClose()
    } catch (err) {
      const msg = friendlyError((err as Error).message)
      setError(msg)
      showToast(msg, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Slett bruker</h2>
        <p className="text-sm text-gray-600 mb-1">
          Er du sikker på at du vil slette <strong>{label}</strong>?
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Dette fjerner brukeren permanent. Tilfluktsrom, dokumenter og
          invitasjoner brukeren har opprettet blir overført til deg.
        </p>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteUser.isPending}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {deleteUser.isPending ? 'Sletter...' : 'Slett bruker'}
          </button>
        </div>
      </div>
    </div>
  )
}
