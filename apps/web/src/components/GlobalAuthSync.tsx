'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabaseBrowser'
import { AuthSyncComponent } from './AuthSyncComponent'

export function GlobalAuthSync() {
  const [token, setToken] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'pending' | 'synced' | 'missing' | 'failed'>('pending')

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()
    
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) {
        setToken(data.session.access_token)
      }
    })

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setToken(session?.access_token || null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (!mounted || !token) return null

  // Wrap in a fixed div so it stays out of the way but still mounts on the DOM
  const opacityClass = syncStatus === 'synced' ? 'opacity-20 hover:opacity-100' : 'opacity-100'
  return (
    <div className={`fixed bottom-4 right-4 z-50 w-80 shadow-lg shadow-black/20 rounded-lg overflow-hidden transition-opacity ${opacityClass} pointer-events-auto`}>
      <div className="bg-[#09090b] border border-white/10 rounded-lg p-0.5">
        <AuthSyncComponent accessToken={token} onStatusChange={setSyncStatus} />
      </div>
    </div>
  )
}
