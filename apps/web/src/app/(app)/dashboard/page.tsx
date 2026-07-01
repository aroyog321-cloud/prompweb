'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '../../../lib/supabaseBrowser'
import UpgradeModal from '../../../components/UpgradeModal'

import { BarChart2, Cpu, ArrowRight, Globe, MessageSquare, Bot, Star, Trash2, Copy } from 'lucide-react'

const Shimmer = () => (
  <motion.div
    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
    animate={{ translateX: ['-100%', '200%'] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
  />
)

const DashboardSkeleton = () => (
  <main className="min-h-[calc(100vh-73px)] pb-32 relative overflow-hidden bg-background text-foreground">
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <div className="flex flex-col gap-4">
        <div className="h-10 w-80 bg-promptly-surface rounded-lg relative overflow-hidden"><Shimmer /></div>
        <div className="h-5 w-96 bg-promptly-surface rounded-lg relative overflow-hidden"><Shimmer /></div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="h-[200px] bg-promptly-surface rounded-2xl relative overflow-hidden"><Shimmer /></div>
        <div className="h-[200px] bg-promptly-surface rounded-2xl relative overflow-hidden"><Shimmer /></div>
      </div>
      <div className="h-[300px] w-full bg-promptly-surface rounded-2xl relative overflow-hidden"><Shimmer /></div>
    </div>
  </main>
)

import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<'free' | 'pro' | 'expert'>('free')

  const [authError, setAuthError] = useState<string | null>(null)
  
  interface PromptHistoryItem {
    id: string;
    originalPrompt: string | null;
    optimizedPrompt: string | null;
    platformUsed: string;
    promptMode: string | null;
    isStarred: boolean;
    responseTime: number | null;
    createdAt: string;
  }
  
  const [stats, setStats] = useState<{ total_requests_today: number; regenerations_today: number; tier?: string } | null>({
    total_requests_today: 0,
    regenerations_today: 0,
  })
  
  const [contextsCount, setContextsCount] = useState(0)
  const [recentPrompts, setRecentPrompts] = useState<Array<PromptHistoryItem>>([])
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // FIX #6 & #7: Stabilise supabase client reference so it doesn't trigger re-renders
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      const errorDescription = params.get('error_description')
      if (error) {
        setTimeout(() => setAuthError(`Authentication Failed: ${errorDescription || error}`), 0)
        setTimeout(() => router.push('/login'), 3000)
        return
      }
    }

    async function loadData() {
      try {
        await supabase.auth.getSession()
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !currentUser) {
          router.push('/login')
          return
        }
        

        
        setUser(currentUser)
        
        // Load Usage Stats
        const { data: statsData, error: statsError } = await supabase
          .from('usage_stats')
          .select('*')
          .eq('id', currentUser.id)
          .single()

        if (statsError && statsError.code === 'PGRST116') {
          const { data: insertedStats } = await supabase
            .from('usage_stats')
            .insert([{ id: currentUser.id, tier: 'expert', total_requests_today: 0, regenerations_today: 0 }])
            .select()
            .single()
          
          if (insertedStats) {
            setTier('expert')
            setStats(insertedStats)
          }
        } else if (statsData) {
          setTier(statsData.tier as 'free' | 'pro' | 'expert')
          setStats(statsData)
        }

        // Try to load context profiles
        const { count: ctxCount } = await supabase
          .from('ContextProfile')
          .select('*', { count: 'exact', head: true })
          .eq('userId', currentUser.id)
        
        if (ctxCount !== null) setContextsCount(ctxCount)

        // Show all recent prompts - both starred and unstarred
        // The daily cron job handles deleting non-starred entries older than 1 day
        const { data: allPrompts } = await supabase
          .from('PromptHistory')
          .select('*')
          .eq('userId', currentUser.id)
          .order('createdAt', { ascending: false })
          .limit(20)

        setRecentPrompts(allPrompts || [])

      } catch (err) {
        console.error('Error loading user data:', err)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [supabase, router])

  // Close menu on outside click
  useEffect(() => {
    if (!activeMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeMenu])



  const handleDelete = async (id: string) => {
    // FIX #8: Optimistic update with error rollback
    const backup = recentPrompts;
    setRecentPrompts(prev => prev.filter(p => p.id !== id))
    setActiveMenu(null)
    const { error } = await supabase.from('PromptHistory').delete().eq('id', id)
    if (error) {
      console.error("Failed to delete prompt:", error)
      setRecentPrompts(backup) // rollback
    }
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1800)
    setActiveMenu(null)
  }

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'PromptHistory', filter: `userId=eq.${user.id}` }, (payload) => {
        setRecentPrompts((prev: PromptHistoryItem[]) => [payload.new as PromptHistoryItem, ...prev].slice(0, 20));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ContextProfile', filter: `"userId"=eq.${user.id}` }, (_payload) => {
        // Just reload contexts
        supabase.from('ContextProfile').select('*', { count: 'exact', head: true })
          .then(({ count }) => { if (count !== null) setContextsCount(count) });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'usage_stats', filter: `id=eq.${user.id}` }, (payload) => {
        // Update limits inline
        setStats((prev) => prev ? { ...prev, ...(payload.new as Record<string, unknown>) } : { total_requests_today: 0, regenerations_today: 0, ...(payload.new as Record<string, unknown>) });
        window.postMessage({ type: "PROMPTLY_PLAN_UPDATED" }, window.location.origin);
      })
      .subscribe()

    function onVisibility() {
      if (document.visibilityState === 'visible' && user) {
        supabase
          .from('PromptHistory')
          .select('*')
          .eq('userId', user.id)
          .order('createdAt', { ascending: false })
          .limit(20)
          .then(({ data }) => { if (data) setRecentPrompts(data) })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user, supabase])

  if (authError) {
    return (
      <main className="min-h-[calc(100vh-73px)] pb-32 flex items-center justify-center bg-background text-foreground">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl max-w-md text-center">
          <p className="font-semibold">{authError}</p>
          <p className="text-sm mt-2 opacity-80">Redirecting to login...</p>
        </div>
      </main>
    )
  }

  if (loading) return <DashboardSkeleton />

  const optMax = tier === 'free' ? 10 : tier === 'pro' ? 50 : 1000
  const optUsed = stats?.total_requests_today || 0
  const optLeft = Math.max(0, optMax - optUsed)
  const optPercent = Math.min(100, Math.round((optUsed / optMax) * 100))

  const ctxMax = tier === 'free' ? 1 : tier === 'pro' ? 5 : 20
  const ctxPercent = Math.min(100, Math.round((contextsCount / ctxMax) * 100))

  const getPlatformIcon = (platform: string) => {
    if (platform?.toLowerCase().includes('claude')) return <Bot size={20} className="text-orange-400" />
    if (platform?.toLowerCase().includes('gemini')) return <Globe size={20} className="text-blue-400" />
    return <MessageSquare size={20} className="text-emerald-400" />
  }

  return (
    <main className="min-h-[calc(100vh-73px)] pb-32 bg-background text-foreground font-sans">
      
      {/* Background Gradients (Subtle) */}
      <div className="absolute top-0 left-0 w-[600px] h-[400px] bg-promptly-glow opacity-30 rounded-full pointer-events-none" />

      <div className="max-w-[1000px] mx-auto px-6 py-12 relative z-10">
        
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-[32px] font-semibold tracking-tight text-white flex items-center gap-3">
            Command Center <span className="text-zinc-600 font-normal">|</span> <span className="text-zinc-300">Dashboard</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
            Monitor prompt optimization usage, manage active context profiles, and view remaining credits.
          </p>
        </header>

        {/* Top Row: Requests Today, Plan, Prompt Quality */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          
          {/* Card: Requests Today */}
          <div className="bg-[#1a1a1c] border border-white/[0.04] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Requests Today</span>
                <div className="size-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                  <BarChart2 size={16} className="text-blue-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">{optUsed}</span>
                {tier !== 'expert' && <span className="text-xl font-bold tracking-tight text-zinc-600">/{optMax}</span>}
              </div>
            </div>
            {tier !== 'expert' && (
              <div className="mt-6">
                <div className="flex justify-between text-xs text-zinc-400 mb-2 font-medium">
                  <span>Utilization</span>
                  <span>{optPercent}%</span>
                </div>
                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${optPercent}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Card: Plan */}
          <div className="bg-[#1a1a1c] border border-white/[0.04] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Current Plan</span>
                <div className="size-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                  <Cpu size={16} className="text-purple-400" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-3xl font-bold tracking-tight text-white capitalize">{tier} Plan</span>
                <p className="text-sm text-zinc-400">
                  {tier === 'expert' ? "Unlimited optimizations." : `${optLeft} optimizations left today.`}
                </p>
              </div>
            </div>
            {tier !== 'expert' && (
              <div className="mt-4">
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg text-sm transition-colors border border-white/10"
                >
                  Upgrade Plan
                </button>
              </div>
            )}
          </div>

          {/* Card: Prompt Quality */}
          <div className="bg-[#1a1a1c] border border-white/[0.04] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Avg Prompt Quality</span>
                <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Star size={16} className="text-emerald-400 fill-emerald-400/20" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">N/A</span>
              </div>
              <p className="text-sm text-zinc-500 mt-2 flex items-center gap-1.5">
                Coming soon
              </p>
            </div>
          </div>
        </div>

        {/* Middle Row: Recent Optimizations, Usage Chart */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          
          {/* Usage Chart Placeholder */}
          <div className="md:col-span-1 bg-[#1a1a1c] border border-white/[0.04] rounded-2xl p-6 flex flex-col h-[400px]">
             <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-300">Usage History</h2>
              <div className="text-xs text-zinc-500">Coming soon</div>
            </div>
            <div className="flex-1 rounded-xl bg-white/[0.02] border border-white/[0.02] flex items-center justify-center">
               <div className="flex flex-col items-center gap-3 text-zinc-500">
                 <BarChart2 size={32} className="opacity-50" />
                 <span className="text-sm">Chart data unavailable</span>
               </div>
            </div>
          </div>

          {/* Recent Optimizations */}
          <div className="md:col-span-2 bg-[#1a1a1c] border border-white/[0.04] rounded-2xl overflow-hidden flex flex-col h-[400px]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04] shrink-0">
              <h2 className="text-lg font-semibold text-white tracking-tight">Recent Optimizations</h2>
              <Link href="/history" className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                View All <ArrowRight size={12} />
              </Link>
            </div>
            
            <div className="flex flex-col overflow-y-auto custom-scrollbar" ref={menuRef}>
              {/* Copy toast */}
              <AnimatePresence>
                {copied && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-white/10 text-white text-xs font-medium px-4 py-2 rounded-full shadow-xl"
                  >
                    ✓ {copied} copied
                  </motion.div>
                )}
              </AnimatePresence>

              {recentPrompts.length === 0 ? (
                <div className="px-6 py-12 flex flex-col items-center justify-center text-center gap-4 my-auto">
                  <div className="size-12 rounded-full bg-promptly-surface border border-promptly-border flex items-center justify-center relative shadow-[0_0_20px_rgba(139,108,255,0.15)]">
                    <Bot size={20} className="text-promptly-violet" />
                  </div>
                  <div>
                    <h3 className="text-zinc-200 font-medium text-sm mb-1">No prompts yet</h3>
                    <p className="text-zinc-500 text-xs max-w-[250px]">Optimize a prompt in the extension to see it here.</p>
                  </div>
                </div>
              ) : (
                recentPrompts.map((prompt, idx) => (
                <div 
                  key={prompt.id} 
                  className={`px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors ${idx !== recentPrompts.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-8 rounded-lg bg-[#242427] border border-white/[0.04] flex items-center justify-center shrink-0">
                      {getPlatformIcon(prompt.platformUsed)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-white truncate max-w-[150px] sm:max-w-[250px]">
                        {prompt.originalPrompt || "Optimization"}
                      </h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {new Date(prompt.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium text-zinc-300">{prompt.responseTime ? `${(prompt.responseTime * 1000).toFixed(0)}ms` : 'Local'}</p>
                    </div>
                    
                    {/* Three-dot menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === prompt.id ? null : prompt.id) }}
                        className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>

                      <AnimatePresence>
                        {activeMenu === prompt.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.12 }}
                            className="absolute right-0 top-8 z-50 w-48 bg-[#1e1e20] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}
                          >
                            <button onClick={() => handleCopy(prompt.originalPrompt || '', 'Original')} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors text-left">
                              <Copy size={13} className="text-zinc-500" /> Copy original
                            </button>
                            <button onClick={() => handleCopy(prompt.optimizedPrompt || '', 'Optimized')} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors text-left">
                              <Copy size={13} className="text-zinc-500" /> Copy optimized
                            </button>
                            <div className="h-px bg-white/[0.05] mx-2 my-1" />
                            <button onClick={() => handleDelete(prompt.id)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left">
                              <Trash2 size={13} /> Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Saved Profiles, History */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Card: Saved Profiles */}
          <div className="bg-[#1a1a1c] border border-white/[0.04] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Active Contexts</span>
                <div className="size-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                  <Globe size={16} className="text-indigo-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">{contextsCount}</span>
                <span className="text-xl font-bold tracking-tight text-zinc-600">/{ctxMax}</span>
              </div>
              <p className="text-sm text-zinc-400 mt-2">
                Context profiles currently synced to the extension.
              </p>
            </div>
            
            <div className="mt-8">
              <div className="flex justify-between text-xs text-zinc-400 mb-2 font-medium">
                <span>Utilization</span>
                <span>{ctxPercent}%</span>
              </div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${ctxPercent}%` }} />
              </div>
            </div>
          </div>

          {/* Card: Quick Setup Guide */}
          <div className="bg-[#1a1a1c] border border-white/[0.04] rounded-2xl p-6 flex flex-col justify-center">
             <div className="flex items-center gap-4 mb-4">
               <div className="size-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                 <Cpu className="text-purple-400" size={20} />
               </div>
               <div>
                 <h2 className="text-base font-semibold text-white tracking-tight">System Status</h2>
                 <p className="text-xs text-zinc-400">All systems operational.</p>
               </div>
             </div>
             <p className="text-sm text-zinc-400 leading-relaxed mb-6">
               Your extension is connected and ready. Highlight text on any page and click the Promptly orb to rewrite your prompt instantly.
             </p>
             <Link 
               href="/settings"
               className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg text-sm transition-colors border border-white/10"
             >
               Manage Settings <ArrowRight size={14} />
             </Link>
          </div>
        </div>
      </div>
      
      {/* Upgrade Modal */}
      {user && (
        <UpgradeModal 
          isOpen={showUpgradeModal} 
          onClose={() => setShowUpgradeModal(false)} 
          user={user} 
        />
      )}
    </main>
  )
}
