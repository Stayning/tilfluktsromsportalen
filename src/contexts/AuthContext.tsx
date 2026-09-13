import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  signInWithOtp: (phone: string) => Promise<{ error: Error | null }>
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (data: ProfileUpdate) => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string, accessToken: string) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`
    const response = await fetch(url, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data?.[0] || null
  }, [])

  const checkIsAdmin = useCallback(async (userId: string, accessToken: string) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/app_admins?user_id=eq.${userId}&select=user_id`
    const response = await fetch(url, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      }
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    return data && data.length > 0
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user || !session?.access_token) return

    const profileData = await fetchProfile(user.id, session.access_token)
    if (profileData) {
      setProfile(profileData)
    }

    const adminStatus = await checkIsAdmin(user.id, session.access_token)
    setIsAdmin(adminStatus)
  }, [user, session, fetchProfile, checkIsAdmin])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    let hasLoaded = false

    // Fallback timeout in case onAuthStateChange doesn't fire
    timeoutId = setTimeout(() => {
      if (!hasLoaded) {
        setLoading(false)
      }
    }, 3000)

    // Set up auth state listener - this fires immediately with current session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user && session.access_token) {
        try {
          const profileData = await fetchProfile(session.user.id, session.access_token)
          setProfile(profileData)

          const adminStatus = await checkIsAdmin(session.user.id, session.access_token)
          setIsAdmin(adminStatus)
        } catch {
          // Silent fail - user will be redirected to onboarding if profile is null
        }
      } else {
        setProfile(null)
        setIsAdmin(false)
      }

      hasLoaded = true
      if (timeoutId) clearTimeout(timeoutId)
      setLoading(false)
    })

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [fetchProfile, checkIsAdmin])

  const signInWithOtp = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return { error }
  }

  const verifyOtp = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setIsAdmin(false)
  }

  const updateProfile = async (data: ProfileUpdate) => {
    if (!user || !session?.access_token) {
      return { error: new Error('Ingen bruker logget inn') }
    }

    // Update profiles table
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: user.id,
        phone: user.phone,
        ...data,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { error: new Error(errorText) }
    }

    // Also update auth.users metadata (display_name, email)
    const displayName = [data.first_name, data.last_name].filter(Boolean).join(' ')
    const authUpdate: { email?: string; data?: { display_name: string } } = {}

    if (data.email) {
      authUpdate.email = data.email
    }
    if (displayName) {
      authUpdate.data = { display_name: displayName }
    }

    if (Object.keys(authUpdate).length > 0) {
      await supabase.auth.updateUser(authUpdate)
    }

    await refreshProfile()
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isAdmin,
        loading,
        signInWithOtp,
        verifyOtp,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
