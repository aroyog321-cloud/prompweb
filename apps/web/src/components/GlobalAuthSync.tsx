'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabaseBrowser'
import { AuthSyncComponent } from './AuthSyncComponent'

export function GlobalAuthSync() {
  const [token, setToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'pending' | 'synced' | 'missing' | 'failed'>('pending')

  useEffect(() => {
    setTimeout(() => setMounted(true), 0)
    const supabase = createClient()

    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) {
        setToken(data.session.access_token)
        setRefreshToken(data.session.refresh_token)
      }
    })

    // Listen for auth changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setToken(session?.access_token || null)
      setRefreshToken(session?.refresh_token || null)
    })

    // Proactively refresh the session every 45 minutes.
    // Supabase JWTs expire after 1 hour. Without this, the extension receives a
    // 401 roughly 60 minutes after login with no visible error to the user.
    const refreshInterval = setInterval(async () => {
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data.session?.access_token) {
        setToken(data.session.access_token)
        setRefreshToken(data.session.refresh_token)
      }
    }, 45 * 60 * 1000) // 45 minutes

    return () => {
      subscription.unsubscribe()
      clearInterval(refreshInterval)
    }
  }, [])

  if (!mounted || !token || !refreshToken) return null

  // Wrap in a fixed div so it stays out of the way but still mounts on the DOM
  const opacityClass = syncStatus === 'synced' ? 'opacity-20 hover:opacity-100' : 'opacity-100'
  return (
    <div className={`fixed bottom-4 right-4 z-50 w-80 shadow-lg shadow-black/20 rounded-lg overflow-hidden transition-opacity ${opacityClass} pointer-events-auto`}>
      <div className="bg-[#09090b] border border-white/10 rounded-lg p-0.5">
        <AuthSyncComponent 
          accessToken={token} 
          refreshToken={refreshToken}
          supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL || ""}
          supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}
          onStatusChange={setSyncStatus} 
        />
      </div>
    </div>
  )
}
