import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toDisplayPhone } from '@/lib/phone'
import { UserPlus } from 'lucide-react'
import { formatPhoneNumber } from 'react-phone-number-input'

export default function Onboarding() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { user, profile, updateProfile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!tosAccepted) {
      setError('Du må godta tjenestevilkårene for å fortsette.')
      return
    }

    setLoading(true)

    const { error } = await updateProfile({
      first_name: firstName,
      last_name: lastName,
      email: email,
      tos_accepted_at: new Date().toISOString(),
    })

    if (error) {
      // Check for duplicate email error
      if (error.message.includes('profiles_email_unique') || error.message.includes('duplicate')) {
        setError('Denne e-postadressen er allerede registrert. Vennligst bruk en annen e-post.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    // Call accept-invite Edge Function to process any pending invites
    try {
      await supabase.functions.invoke('accept-invite')
    } catch {
      // Non-critical - continue even if invite processing fails
    }

    navigate('/oversikt')
  }

  // Get phone from multiple sources - auth user, user metadata, or profile
  const rawPhone = user?.phone || user?.user_metadata?.phone || profile?.phone || ''
  const phone = toDisplayPhone(rawPhone) ?? ''

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
        <div className="mx-auto w-full max-w-md px-4 text-center">
          <div className="text-gray-500">Laster...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <UserPlus className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Fullfør profilen din</h1>
          <p className="text-gray-600 mt-2">
            Det ser ut som du er ny her. Vennligst oppgi opplysningene dine for å opprette en konto for tilgang til tilfluktsrom.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fornavn
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="f.eks. Ola"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Etternavn
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="f.eks. Nordmann"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-postadresse
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="f.eks. ola.nordmann@example.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registrert telefon
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  value={phone ? formatPhoneNumber(phone) : ''}
                  disabled
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500"
                />
                <span className="text-green-500">✓</span>
              </div>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="text-sm">
                  <span className="text-gray-700">
                    Jeg godtar{' '}
                    <a href="#" className="text-blue-600 hover:underline">
                      personvernerklæringen
                    </a>{' '}
                    og{' '}
                    <a href="#" className="text-blue-600 hover:underline">
                      tjenestevilkårene
                    </a>
                    .
                  </span>
                  <p className="text-gray-500 mt-1">
                    Dine data vil bli behandlet i henhold til GDPR-regelverket for tilfluktsrompersonell.
                  </p>
                </div>
              </label>
            </div>

            {error && (
              <p className="text-red-600 text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Oppretter konto...' : 'Opprett konto'}
              {!loading && <UserPlus className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-4">
          <a href="/innlogging" className="text-blue-600 hover:underline">
            ← Tilbake til innlogging
          </a>
        </p>
      </div>
    </div>
  )
}
