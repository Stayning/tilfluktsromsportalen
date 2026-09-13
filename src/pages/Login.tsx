import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Building2 } from 'lucide-react'
import PhoneInput, { isValidPhoneNumber, formatPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

export default function Login() {
  const [phone, setPhone] = useState<string | undefined>()
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { signInWithOtp, verifyOtp } = useAuth()
  const navigate = useNavigate()

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!phone || !isValidPhoneNumber(phone)) {
      setError('Vennligst skriv inn et gyldig telefonnummer')
      return
    }

    setLoading(true)

    const { error } = await signInWithOtp(phone)

    if (error) {
      setError(error.message)
    } else {
      setStep('otp')
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await verifyOtp(phone!, otp)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // After successful verification, try to process any pending invites
    try {
      await supabase.functions.invoke('accept-invite')
    } catch {
      // Non-critical, continue
    }

    // Navigation will be handled by the route guard based on profile state
    navigate('/oversikt')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            <span className="font-semibold text-gray-900">Tilfluktsromportalen</span>
          </div>
          <button className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1">
            <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs">?</span>
            Hjelp
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-center">
        <div className="mx-auto w-full max-w-md px-4">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Velkommen tilbake</h1>
            <p className="text-gray-600 mt-2">
              Skriv inn mobilnummeret ditt for å motta en innloggingskode.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            {step === 'phone' ? (
              <form onSubmit={handleRequestOtp}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefonnummer
                </label>
                <div className="mb-4">
                  <PhoneInput
                    international
                    defaultCountry="NO"
                    value={phone}
                    onChange={setPhone}
                    className="phone-input-container"
                  />
                </div>

                {error && (
                  <p className="text-red-600 text-sm mb-4">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !phone}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? 'Sender...' : 'Send kode'}
                  {!loading && <span>→</span>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <p className="text-sm text-gray-600 mb-4">
                  Vi sendte en 6-sifret kode til <strong>{phone ? formatPhoneNumber(phone) : ''}</strong>
                </p>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verifiseringskode
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
                  maxLength={6}
                  required
                />

                {error && (
                  <p className="text-red-600 text-sm mb-4">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Verifiserer...' : 'Bekreft'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('phone')
                    setOtp('')
                    setError(null)
                  }}
                  className="w-full mt-2 text-gray-600 py-2 px-4 hover:text-gray-900 text-sm"
                >
                  ← Bruk et annet nummer
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-gray-500 text-sm mt-4">
            Har du problemer med å logge inn?{' '}
            <a href="#" className="text-blue-600 hover:underline font-medium">
              Kontakt kundestøtte
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
