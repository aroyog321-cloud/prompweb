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

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<'free' | 'pro' | 'expert'>('free')
  const [token, setToken] = useState<string | null>(null)
  
  const [stats, setStats] = useState<any>({
    total_requests_today: 0,
    regenerations_today: 0,
  })
  
  const [contextsCount, setContextsCount] = useState(0)
  const [recentPrompts, setRecentPrompts] = useState<any[]>([])
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      const errorDescription = params.get('error_description')
      if (error) {
        alert(`Authentication Failed: ${errorDescription || error}\n\nPlease try signing up or logging in again.`)
        window.location.href = '/login'
        return
      }
    }

    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user || null
        const currentToken = session?.access_token || null
        
        if (!currentUser) {
          window.location.href = '/login'
          return
        }
        
        setUser(currentUser)
        setToken(currentToken)
        
        // Load Usage Stats
        const { data: statsData, error: statsError } = await supabase
          .from('usage_stats')
          .select('*')
          .eq('id', currentUser.id)
          .single()

        if (statsError && statsError.code === 'PGRST116') {
          const { data: insertedStats } = await supabase
            .from('usage_stats')
            .insert([{ id: currentUser.id, tier: 'free' }])
            .select()
            .single()
          
          if (insertedStats) {
            setTier(insertedStats.tier as 'free' | 'pro' | 'expert')
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
        window.location.href = '/login'
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (!activeMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActiveMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeMenu])

  const handleStar = async (id: string, current: boolean) => {
    setRecentPrompts(prev => prev.map(p => p.id === id ? { ...p, isStarred: !current } : p))
    await supabase.from('PromptHistory').update({ isStarred: !current }).eq('id', id)
    setActiveMenu(null)
  }

  const handleDelete = async (id: string) => {
    setRecentPrompts(prev => prev.filter(p => p.id !== id))
    await supabase.from('PromptHistory').delete().eq('id', id)
    setActiveMenu(null)
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
        setRecentPrompts((prev: any[]) => [payload.new, ...prev].slice(0, 20));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ContextProfile', filter: `"userId"=eq.${user.id}` }, (payload) => {
        // Just reload contexts
        supabase.from('ContextProfile').select('*', { count: 'exact', head: true })
          .then(({ count }) => { if (count !== null) setContextsCount(count) });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'usage_stats', filter: `id=eq.${user.id}` }, (payload) => {
        // Update limits inline
        setStats((prev: any) => ({ ...prev, ...payload.new }));
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
  }, [user])

  if (loading) return <DashboardSkeleton />

  const optMax = tier === 'free' ? 10 : tier === 'pro' ? 50 : 1000
  const optUsed = stats.total_requests_today || 0
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

        <div className="mb-8 bg-[#1a1a1c] border border-white/[0.04] rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-300">Optimization Metrics</h2>
            <div className="text-xs text-zinc-500">Coming soon</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-2xl font-bold text-white">0</div>
              <div className="text-xs text-zinc-400 mt-1">Avg Latency (ms)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">0</div>
              <div className="text-xs text-zinc-400 mt-1">Tokens Saved</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">--</div>
              <div className="text-xs text-zinc-400 mt-1">Most Used Mode</div>
            </div>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          
          {/* Card 1: Contexts */}
          <div className="bg-[#1a1a1c] border border-white/[0.04] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Active Contexts</span>
                <div className="size-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                  <BarChart2 size={16} className="text-zinc-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight text-white">{contextsCount}</span>
                <span className="text-2xl font-bold tracking-tight text-zinc-600">/{ctxMax}</span>
              </div>
            </div>
            
            <div className="mt-8">
              <div className="flex justify-between text-xs text-zinc-400 mb-2 font-medium">
                <span>Utilization</span>
                <span>{ctxPercent}%</span>
              </div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div className="h-full bg-[#8ba3f8] rounded-full transition-all duration-700" style={{ width: `${ctxPercent}%` }} />
              </div>
            </div>
          </div>

          {/* Card 2: Subscription */}
          <div className="bg-[#1a1a1c] border border-white/[0.04] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Current Subscription</span>
                <div className="size-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                  <Cpu size={16} className="text-purple-400" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-bold tracking-tight text-white capitalize">{tier} Plan</span>
                {tier !== 'expert' && (
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="px-4 py-1.5 bg-[#2dd4bf] text-black font-semibold rounded-full text-sm hover:bg-[#2dd4bf]/90 transition-colors shadow-[0_0_15px_rgba(45,212,191,0.2)]"
                  >
                    Upgrade
                  </button>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-3">
                {tier === 'expert' ? (
                  "Unlimited optimizations remaining today."
                ) : (
                  `${optLeft} of ${optMax} optimizations remaining today.`
                )}
              </p>
            </div>
          </div>

        </div>

        {/* List Section */}
        <div className="bg-[#1a1a1c] border border-white/[0.04] rounded-2xl overflow-hidden mb-8">
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04]">
            <h2 className="text-lg font-semibold text-white tracking-tight">Recent Optimizations</h2>
            <Link href="/history" className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          
          <div className="flex flex-col" ref={menuRef}>
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
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-6 py-12 flex flex-col items-center justify-center text-center gap-4"
              >
                <div className="size-16 rounded-full bg-promptly-surface border border-promptly-border flex items-center justify-center relative shadow-[0_0_20px_rgba(139,108,255,0.15)]">
                  <Bot size={28} className="text-promptly-violet" />
                  <motion.div 
                    className="absolute inset-0 rounded-full border border-promptly-cyan/30"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <div>
                  <h3 className="text-zinc-200 font-medium text-base mb-1">✨ Start optimizing prompts</h3>
                  <p className="text-zinc-500 text-sm max-w-sm">Your prompt history will appear here. Try optimizing a prompt in the extension to see it live.</p>
                </div>
              </motion.div>
            ) : (
              recentPrompts.map((prompt, idx) => (
              <motion.div 
                key={prompt.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.5), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={`px-6 py-5 flex items-center justify-between hover:bg-promptly-surface hover:scale-[1.005] transition-all duration-300 ${idx !== recentPrompts.length - 1 ? 'border-b border-promptly-border' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-[#242427] border border-white/[0.04] flex items-center justify-center shrink-0">
                    {getPlatformIcon(prompt.platformUsed)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white truncate max-w-[200px] md:max-w-md">
                      {prompt.originalPrompt || "Prompt Optimization"}
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-mono mt-1">
                      Platform: {prompt.platformUsed || 'Unknown'} • {new Date(prompt.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-8">
                  {prompt.isStarred ? (
                    <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                      <span className="text-amber-400">★</span>
                      <span className="text-[11px] font-medium text-amber-300">Starred — Saved</span>
                    </div>
                  ) : (
                    <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium text-zinc-300">Today only</span>
                    </div>
                  )}
                  
                  <div className="text-right hidden sm:block w-20">
                    <p className="text-xs font-semibold text-white">{prompt.responseTime ? `${(prompt.responseTime * 1000).toFixed(0)}ms` : '--'}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Latency</p>
                  </div>
                  
                  {/* Three-dot menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === prompt.id ? null : prompt.id) }}
                      className="text-zinc-600 hover:text-promptly-cyan transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
                      aria-label="More options"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>

                    <AnimatePresence>
                      {activeMenu === prompt.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 top-9 z-50 w-52 bg-[#1e1e20] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden"
                          onClick={e => e.stopPropagation()}
                        >
                          <button onClick={() => handleCopy(prompt.originalPrompt || '', 'Original')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors text-left">
                            <Copy size={13} className="text-zinc-500" /> Copy original
                          </button>
                          <button onClick={() => handleCopy(prompt.optimizedPrompt || '', 'Optimized')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors text-left">
                            <Copy size={13} className="text-zinc-500" /> Copy optimized
                          </button>
                          <div className="h-px bg-white/[0.05] mx-2" />
                          <button onClick={() => handleStar(prompt.id, prompt.isStarred)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors text-left">
                            <Star size={13} className={prompt.isStarred ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'} />
                            {prompt.isStarred ? 'Unstar' : 'Star & save'}
                          </button>
                          <div className="h-px bg-white/[0.05] mx-2" />
                          <button onClick={() => handleDelete(prompt.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left">
                            <Trash2 size={13} /> Delete
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="bg-[#1a1a1c] border border-white/[0.04] rounded-2xl overflow-hidden p-8">
          <div className="flex flex-col gap-2 mb-6">
            <h2 className="text-xl font-semibold text-white tracking-tight">Quick Start Guide</h2>
            <p className="text-sm text-zinc-400">Master Promptly in 60 seconds and start writing perfect prompts effortlessly.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-3 p-5 rounded-xl bg-white/[0.02] border border-white/[0.03]">
              <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mb-2">
                1
              </div>
              <h3 className="font-semibold text-zinc-200">The Floating Orb</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Click the Promptly orb on ChatGPT or Claude to instantly optimize the prompt you're currently writing. You can also drag the orb anywhere on the screen.
              </p>
            </div>
            
            <div className="flex flex-col gap-3 p-5 rounded-xl bg-white/[0.02] border border-white/[0.03]">
              <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2">
                2
              </div>
              <h3 className="font-semibold text-zinc-200">Auto-Optimize Shortcut</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                <strong className="text-white">Double-click</strong> the orb, or press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono border border-white/20 mx-1">Ctrl+Shift+P</kbd> to automatically optimize and insert your prompt without opening the panel.
              </p>
            </div>
            
            <div className="flex flex-col gap-3 p-5 rounded-xl bg-white/[0.02] border border-white/[0.03]">
              <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                3
              </div>
              <h3 className="font-semibold text-zinc-200">Context Memory</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Head over to the extension settings to define your default <strong className="text-white">Context Profile</strong>. Promptly will inject this context seamlessly into every prompt you write.
              </p>
            </div>
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
