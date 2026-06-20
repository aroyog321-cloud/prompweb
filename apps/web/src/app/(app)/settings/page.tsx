'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabaseBrowser'
import { AuthSyncComponent } from '../../../components/AuthSyncComponent'
import { User, Download, Shield, LogOut } from 'lucide-react'

const SettingsSkeleton = () => (
  <main className="min-h-[calc(100vh-73px)] pb-32 bg-[#09090b] text-white">
    <div className="max-w-[800px] mx-auto px-6 py-12 space-y-8 animate-pulse">
      <div className="flex flex-col gap-4">
        <div className="h-10 w-64 bg-white/5 rounded-lg" />
        <div className="h-5 w-96 bg-white/5 rounded-lg" />
      </div>
      <div className="h-[200px] w-full bg-[#1a1a1c] rounded-2xl" />
      <div className="h-[200px] w-full bg-[#1a1a1c] rounded-2xl" />
    </div>
  </main>
)

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          setToken(session.access_token)
        } else {
          window.location.href = '/login'
        }
      } catch (err) {
        window.location.href = '/login'
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) return <SettingsSkeleton />

  return (
    <main className="min-h-[calc(100vh-73px)] pb-32 bg-[#09090b] text-white font-sans relative overflow-hidden">
      
      {/* Background Gradients (Subtle) */}
      <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-[800px] mx-auto px-6 py-12 relative z-10">
        
        {/* Header */}
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-white flex items-center gap-3">
              Account Settings
            </h1>
            <p className="text-sm text-zinc-400 mt-2">
              Manage your credentials, extension sync, and data privacy.
            </p>
          </div>
          
          <button 
            onClick={handleSignOut} 
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </header>

        <div className="space-y-6">
          
          {/* Extension Status Block */}
          <section className="bg-[#1a1a1c] border border-white/[0.04] p-6 md:p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Shield className="text-blue-400" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">Extension Sync Status</h2>
                <p className="text-xs text-zinc-400">Ensure your Chrome extension is connected to your account.</p>
              </div>
            </div>
            
            <div className="-mt-2 mb-2">
              <AuthSyncComponent accessToken={token || ''} />
            </div>
            <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
              When synced, your extension will automatically fetch your active Context Profiles and securely send optimization requests to your account.
            </p>
          </section>

          {/* Profile Block */}
          <section className="bg-[#1a1a1c] border border-white/[0.04] p-6 md:p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <User className="text-purple-400" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">Profile Information</h2>
                <p className="text-xs text-zinc-400">Your core identity on Promptly.</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-widest">
                  Email Address
                </label>
                <div className="px-4 py-3 bg-[#09090b] border border-white/[0.04] rounded-xl text-zinc-300 text-sm">
                  {user?.email}
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-widest">
                  Account ID
                </label>
                <div className="px-4 py-3 bg-[#09090b] border border-white/[0.04] rounded-xl text-zinc-500 font-mono text-sm">
                  {user?.id}
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  )
}
