'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut, Settings, LayoutDashboard } from 'lucide-react'
import { createClient } from '../lib/supabaseBrowser'

function BottomDockNav() {
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
    })
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    
    return () => authListener.subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Only render the dock if we are logged in (though (app) layout implies we are)
  if (!user) return null

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <nav className="flex items-center gap-2 p-2 rounded-full bg-zinc-900/60 backdrop-blur-2xl border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]">
        
        <Link 
          href="/dashboard" 
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
            pathname === '/dashboard' 
              ? 'bg-white/10 text-white shadow-inner border border-white/5' 
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <LayoutDashboard size={18} />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        
        <Link 
          href="/settings" 
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
            pathname === '/settings' 
              ? 'bg-white/10 text-white shadow-inner border border-white/5' 
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings size={18} />
          <span className="hidden sm:inline">Settings</span>
        </Link>
        
        <div className="w-px h-6 bg-white/10 mx-1" />
        
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
        
      </nav>
    </div>
  )
}

export function NavigationManager() {
  return <BottomDockNav />
}
