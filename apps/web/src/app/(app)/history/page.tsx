'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '../../../lib/supabaseBrowser'
import { Bot, Globe, MessageSquare, Star, Trash2, Copy, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import Link from 'next/link'

const PAGE_SIZE = 25

function getPlatformIcon(platform: string) {
  if (platform?.toLowerCase().includes('claude')) return <Bot size={18} className="text-orange-400" />
  if (platform?.toLowerCase().includes('gemini')) return <Globe size={18} className="text-blue-400" />
  return <MessageSquare size={18} className="text-emerald-400" />
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

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

export default function HistoryPage() {
  const [prompts, setPrompts] = useState<PromptHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [supabase] = useState(() => createClient())

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [search])

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setToken(session.access_token)
      setUser(session.user)

      // Live updates: re-fetch when a new history row is inserted
      const channel = supabase
        .channel('prompt-history-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'PromptHistory',
            filter: `userId=eq.${session.user.id}`,
          },
          () => {
            setPage(0)
            fetchHistory()
          }
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })
  }, [fetchHistory, supabase])

  // Fetch
  const fetchHistory = useCallback(async () => {
    if (!token || !user) return
    setLoading(true)
    try {
      let query = supabase
        .from('PromptHistory')
        .select('*', { count: 'exact' })
        .eq('userId', user.id)
        .order('createdAt', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (debouncedSearch.trim()) {
        query = query.ilike('originalPrompt', `%${debouncedSearch}%`)
      }

      const { data, count } = await query
      setPrompts(data || [])
      setTotalCount(count || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [token, user, page, debouncedSearch, supabase])

  useEffect(() => { 
    const t = setTimeout(() => fetchHistory(), 0); 
    return () => clearTimeout(t);
  }, [fetchHistory])

  // Realtime subscription
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('history-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'PromptHistory',
        filter: `userId=eq.${user.id}`,
      }, () => fetchHistory())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchHistory, supabase])

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleStar = async (id: string, current: boolean) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, isStarred: !current } : p))
    await supabase.from('PromptHistory').update({ isStarred: !current }).eq('id', id)
    setActiveMenu(null)
  }

  const handleDelete = async (id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id))
    setTotalCount(prev => prev - 1)
    await supabase.from('PromptHistory').delete().eq('id', id)
    setActiveMenu(null)
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1800)
    setActiveMenu(null)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <main className="min-h-[calc(100vh-73px)] pb-32 bg-background text-foreground font-sans">
      <div className="absolute top-0 left-0 w-[600px] h-[400px] bg-promptly-glow opacity-20 rounded-full pointer-events-none" />

      <div className="max-w-[1000px] mx-auto px-6 py-12 relative z-10">

        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-3">
              <ChevronLeft size={13} /> Back to Dashboard
            </Link>
            <h1 className="text-[32px] font-semibold tracking-tight text-white">Prompt History</h1>
            <p className="text-sm text-zinc-400 mt-1">{totalCount} total optimizations</p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search prompts…"
              className="w-full bg-[#1a1a1c] border border-white/[0.06] rounded-xl pl-9 pr-9 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-promptly-cyan/40 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                <X size={13} />
              </button>
            )}
          </div>
        </header>

        {/* Toast */}
        <AnimatePresence>
          {copied && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-white/10 text-white text-xs font-medium px-4 py-2 rounded-full shadow-xl"
            >
              ✓ {copied} copied
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <div className="bg-[#1a1a1c] border border-white/[0.04] rounded-2xl overflow-hidden">

          {/* Table header */}
          <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-white/[0.04] text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            <span className="w-10" />
            <span>Prompt</span>
            <span>Platform</span>
            <span>Time</span>
            <span className="w-8" />
          </div>

          {loading ? (
            <div className="flex flex-col">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4 border-b border-white/[0.03]">
                  <div className="size-9 rounded-xl bg-white/[0.04] animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 bg-white/[0.04] rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-white/[0.03] rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : prompts.length === 0 ? (
            <div className="py-20 text-center">
              <MessageSquare size={32} className="mx-auto text-zinc-700 mb-4" />
              <p className="text-zinc-500 text-sm">{debouncedSearch ? 'No prompts match your search.' : 'No optimizations yet.'}</p>
            </div>
          ) : (
            <div className="flex flex-col" ref={menuRef}>
              <AnimatePresence initial={false}>
                {prompts.map((prompt, idx) => (
                  <motion.div
                    key={prompt.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`relative px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors ${idx !== prompts.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                  >
                    {/* Platform icon */}
                    <div className="size-9 rounded-xl bg-[#242427] border border-white/[0.04] flex items-center justify-center shrink-0">
                      {getPlatformIcon(prompt.platformUsed)}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {prompt.originalPrompt || 'Prompt Optimization'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-zinc-600 font-mono">{prompt.platformUsed || 'Unknown'}</span>
                        {prompt.promptMode && (
                          <span className="text-[10px] text-zinc-700 bg-white/[0.03] border border-white/[0.05] px-1.5 py-0.5 rounded capitalize">
                            {prompt.promptMode?.toLowerCase().replace('_', ' ')}
                          </span>
                        )}
                        {prompt.isStarred && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">★ Saved</span>
                        )}
                      </div>
                    </div>

                    {/* Latency */}
                    <div className="hidden sm:block text-right w-16 shrink-0">
                      <p className="text-xs font-semibold text-white">{prompt.responseTime ? `${(prompt.responseTime * 1000).toFixed(0)}ms` : '—'}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{timeAgo(prompt.createdAt)}</p>
                    </div>

                    {/* Three-dot menu */}
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === prompt.id ? null : prompt.id) }}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
                        aria-label="More options"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
                            <button
                              onClick={() => handleCopy(prompt.originalPrompt || '', 'Original prompt')}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors text-left"
                            >
                              <Copy size={14} className="text-zinc-500" /> Copy original
                            </button>
                            <button
                              onClick={() => handleCopy(prompt.optimizedPrompt || '', 'Optimized prompt')}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors text-left"
                            >
                              <Copy size={14} className="text-zinc-500" /> Copy optimized
                            </button>
                            <div className="h-px bg-white/[0.05] mx-2" />
                            <button
                              onClick={() => handleStar(prompt.id, prompt.isStarred)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors text-left"
                            >
                              <Star size={14} className={prompt.isStarred ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'} />
                              {prompt.isStarred ? 'Unstar' : 'Star & save'}
                            </button>
                            <div className="h-px bg-white/[0.05] mx-2" />
                            <button
                              onClick={() => handleDelete(prompt.id)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-zinc-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-zinc-400 hover:text-white hover:bg-white/[0.07] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <span className="text-xs text-zinc-500 px-2">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-zinc-400 hover:text-white hover:bg-white/[0.07] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
