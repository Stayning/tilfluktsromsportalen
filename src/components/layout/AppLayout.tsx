import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Building2, LayoutDashboard, Users, LogOut, Briefcase, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
}

const navItems = [
  { href: '/oversikt', label: 'Oversikt', icon: LayoutDashboard },
  { href: '/tilfluktsrom', label: 'Tilfluktsrom', icon: Building2 },
]

const adminNavItems = [
  { href: '/inspeksjonsrapporter', label: 'Inspeksjonsrapporter', icon: FileText },
  { href: '/admin/brukere', label: 'Brukere', icon: Users },
  { href: '/admin/kunder', label: 'Kunder', icon: Briefcase },
]

export default function AppLayout({ children }: AppLayoutProps) {
  const { profile, isAdmin, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/innlogging')
  }

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`
    : 'Bruker'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link to="/oversikt" className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-600" />
              <span className="font-semibold text-gray-900">Tilfluktsromportalen</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    location.pathname === item.href ||
                      location.pathname.startsWith(item.href + '/')
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin &&
                adminNavItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      location.pathname === item.href ||
                        location.pathname.startsWith(item.href + '/')
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {displayName}
              {isAdmin && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Inspektør
                </span>
              )}
            </span>
            <button
              onClick={handleSignOut}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logg ut</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>
    </div>
  )
}
