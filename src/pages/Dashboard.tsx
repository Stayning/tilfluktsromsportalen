import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useShelters } from '@/hooks/useShelters'
import AppLayout from '@/components/layout/AppLayout'
import { Skeleton, StatCardSkeleton } from '@/components/ui/Skeleton'
import { Building2, ChevronRight } from 'lucide-react'

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const { data: shelters, isLoading } = useShelters()

  // Calculate stats
  const totalShelters = shelters?.length || 0

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Oversikt</h1>
          <p className="text-gray-600 mt-1">
            Velkommen tilbake, {profile?.first_name || 'deg'}!
            {isAdmin
              ? ' Du har inspektørtilgang til alle tilfluktsrom.'
              : ' Se dine tildelte tilfluktsrom nedenfor.'}
          </p>
        </div>

        {/* Stats */}
        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {isLoading ? (
              <StatCardSkeleton />
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Totalt tilfluktsrom</p>
                    <p className="text-2xl font-bold text-gray-900">{totalShelters}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent/Assigned Shelters */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {isAdmin ? 'Nylige tilfluktsrom' : 'Dine tilfluktsrom'}
            </h2>
            <Link
              to="/tilfluktsrom"
              className="text-sm text-blue-600 hover:underline"
            >
              Se alle →
            </Link>
          </div>

          {isLoading ? (
            <div className="divide-y divide-gray-200">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-9 h-9 rounded-lg" />
                    <div>
                      <Skeleton className="h-5 w-40 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-5 w-5" />
                  </div>
                </div>
              ))}
            </div>
          ) : !shelters || shelters.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Ingen tilfluktsrom tildelt ennå.</p>
              <p className="text-sm text-gray-400">
                {isAdmin
                  ? 'Registrer tilfluktsrom for å komme i gang.'
                  : 'Du vil se tilfluktsrom her når du blir invitert til et.'}
              </p>
              {isAdmin && (
                <Link
                  to="/tilfluktsrom/ny"
                  className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:underline"
                >
                  Registrer et tilfluktsrom →
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {shelters.slice(0, 5).map((shelter) => (
                <Link
                  key={shelter.id}
                  to={`/tilfluktsrom/${shelter.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Building2 className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {shelter.alias || shelter.kundenavn || shelter.id}
                      </p>
                      <p className="text-sm text-gray-500">
                        {shelter.matrikkel || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
