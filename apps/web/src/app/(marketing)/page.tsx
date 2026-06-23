'use client';

import { useState, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, ResponsiveContainer } from "recharts";
import {
  Zap, Shield, Globe, Terminal, BarChart2,
  Check, ChevronRight, ArrowRight, Brain, History, Lightbulb,
  Plus, Minus
} from "lucide-react";
import Link from "next/link";

const trafficData = [
  { time: "Mon", prompts: 42 },
  { time: "Tue", prompts: 82 },
  { time: "Wed", prompts: 64 },
  { time: "Thu", prompts: 112 },
  { time: "Fri", prompts: 98 },
  { time: "Sat", prompts: 41 },
  { time: "Sun", prompts: 27 },
];

const features = [
  { icon: Zap,       label: "Instant Optimization", desc: "Type your raw thoughts. Proenpt restructures them into a highly effective prompt framework in milliseconds.", color: "#3b82f6" },
  { icon: Brain,     label: "Context Memory",       desc: "Define your tone, audience, and constraints once. Proenpt invisibly injects your unique context.", color: "#8b5cf6" },
  { icon: BarChart2, label: "Quality Breakdown",    desc: "Get real-time scoring on clarity, context, and constraints before you hit send.", color: "#06b6d4" },
  { icon: History,   label: "Undo Stack & History", desc: "Never lose a great prompt. Access a full version history of your prompt iterations and variations.", color: "#10b981" },
  { icon: Lightbulb, label: "Platform-Aware Tips",  desc: "Dynamic suggestions tailored to the specific AI model you are currently chatting with.", color: "#f59e0b" },
  { icon: Shield,    label: "Enterprise Sync",      desc: "Secure syncing across devices. Your keys are encrypted locally, and your prompts stay yours.", color: "#ec4899" },
];

const pricingTiers = [
  {
    name: "Free",
    price: { monthly: 0, annual: 0 },
    desc: "Perfect for casual users getting started with AI.",
    features: ["10 Optimizations / day", "4 Regenerations", "Basic Prompt History", "Community Support"],
    cta: "Start for free",
    href: "/login",
    featured: false,
  },
  {
    name: "Pro",
    price: { monthly: 9, annual: 7 },
    desc: "For power users who need more daily capacity.",
    features: ["50 Optimizations / day", "Unlimited Regenerations", "Context Memory Profiles", "Priority Support"],
    cta: "Subscribe to Pro",
    href: "/login",
    featured: true,
  },
  {
    name: "Expert",
    price: { monthly: 25, annual: 19 },
    desc: "Unlimited access with full context memory unlocked.",
    features: ["Unlimited Optimizations", "Unlimited Regenerations", "Unlimited Context Profiles", "Cross-device Sync"],
    cta: "Subscribe to Expert",
    href: "/login",
    featured: false,
  },
];

const faqs = [
  { q: "Does Proenpt read my chat history?", a: "No. Proenpt only reads the text inside the input box when you explicitly trigger an optimization. It does not monitor or store your conversation history with AI models." },
  { q: "Which platforms are supported?", a: "Proenpt works seamlessly on ChatGPT, Claude, Gemini, Perplexity, Grok, DeepSeek, and practically any website with a text area via the global keyboard shortcut." },
  { q: "Is my Context Memory data private?", a: "Yes. Context Memory profiles are synced securely and are only injected into your prompts at runtime. We do not use your context data to train our own models." },
  { q: "Can I use it for free?", a: "Absolutely. The Free tier provides up to 10 optimizations per day, which is plenty for casual use. You only need to upgrade if you are a power user." }
];

function ScrollReveal({ children, delay = 0 }: { children: ReactNode, delay?: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.5, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Accordion({ title, children }: { title: string, children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.08] py-4">
      <button 
        onClick={() => setOpen(!open)} 
        className="flex w-full items-center justify-between text-left text-zinc-200 font-semibold text-lg py-2 hover:text-white transition-colors"
      >
        {title}
        <span className="text-zinc-500">{open ? <Minus size={18} /> : <Plus size={18} />}</span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
        <p className="text-zinc-400 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [mounted, setMounted] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative overflow-x-hidden bg-background text-foreground selection:bg-promptly-cyan/30">
      {/* ── Ambient glows ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <motion.div
          animate={{ 
            backgroundPosition: ['0% 0%', '100% 100%', '0% 100%', '100% 0%', '0% 0%'],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 opacity-40 mix-blend-screen"
          style={{ 
            background: "var(--background-image-promptly-glow)", 
            filter: "blur(120px)",
            backgroundSize: '200% 200%' 
          }}
        />
      </div>

      {/* ── Hero ── */}
      <section className="relative z-10 min-h-[calc(100vh-73px)] flex flex-col items-center justify-center text-center px-6 pt-24 pb-20">
        <ScrollReveal>
          <div
            className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-xs text-zinc-400"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
            Introducing Proenpt for Chrome
            <ChevronRight size={12} />
          </div>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <h1
            className="font-display text-5xl md:text-7xl lg:text-[88px] font-extrabold leading-[1.05] tracking-tight mb-6 max-w-5xl mx-auto text-transparent bg-clip-text"
            style={{
              backgroundImage: "linear-gradient(135deg, #ffffff 30%, var(--color-promptly-violet) 60%, var(--color-promptly-cyan) 90%)",
            }}
          >
            Supercharge your AI prompts instantly.
          </h1>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Proenpt works alongside ChatGPT, Claude, and Gemini to automatically rewrite, optimize, and organize your prompts for professional-grade AI outputs.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <Link
              href="/login"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5 relative overflow-hidden group text-promptly-void"
              style={{
                background: "var(--color-promptly-cyan)",
                boxShadow: "0 4px 20px rgba(79,230,224,0.4)",
              }}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
              <Zap size={15} />
              Start for free
            </Link>
            <Link
              href="/download"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm text-zinc-300 font-medium border border-white/10 hover:border-white/20 hover:text-white transition-all"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <Terminal size={15} />
              Download Extension
            </Link>
          </div>
          <p className="mt-6 text-xs text-zinc-600">
            No credit card required · Free tier forever · Works locally
          </p>
        </ScrollReveal>

        <ScrollReveal delay={400}>
          {/* Extension Mockup */}
          <div className="mt-16 relative w-full max-w-3xl mx-auto text-left">
            {/* Fake ChatGPT Input Area */}
            <div className="w-full rounded-2xl border border-white/[0.08] bg-[#212121] shadow-2xl p-4 flex gap-4">
              <div className="flex-1 bg-[#2f2f2f] rounded-xl p-4 min-h-[120px] text-zinc-400 font-mono text-sm border border-transparent hover:border-white/10 transition-colors">
                <span className="text-white">help me write an email to my team about the new design system</span>
              </div>
              <div className="flex flex-col justify-end">
                <div className="size-10 rounded-full bg-white text-black flex items-center justify-center cursor-not-allowed">
                  <ArrowRight size={18} />
                </div>
              </div>
            </div>
            
            {/* Fake Proenpt Orb */}
            <div className="absolute top-1/2 -left-6 transform -translate-y-1/2 flex items-center gap-4 z-20">
              <div 
                className="w-12 h-12 rounded-full border border-white/20 shadow-[0_0_30px_rgba(168,85,247,0.6)] cursor-pointer hover:scale-105 transition-transform flex items-center justify-center overflow-hidden z-20"
                style={{ background: 'rgba(20,20,20,0.8)', backdropFilter: 'blur(10px)' }}
                onClick={() => setIsPanelOpen(!isPanelOpen)}
              >
                <img src="/promptly-orb.png" alt="Proenpt Orb" className="w-full h-full object-cover scale-[1.1]" />
              </div>

              {/* Fake Optimizer Panel */}
              <div 
                className={`absolute left-16 top-1/2 -translate-y-1/2 w-[420px] rounded-xl border border-white/[0.1] shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden z-10 transition-all duration-300 origin-left ${isPanelOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
                style={{ background: '#0A0A0A', backdropFilter: 'blur(20px)' }}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08] bg-[#111111]">
                  <div className="flex items-center gap-2">
                    <img src="/promptly-orb.png" alt="Proenpt" className="w-5 h-5 rounded-full" />
                    <span className="text-[12px] font-semibold text-zinc-200">Proenpt</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-2 py-1 rounded bg-[#222] border border-[#333] text-[10px] text-zinc-300 flex items-center gap-1">
                      Mode: Expert <ChevronRight size={10} className="rotate-90" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-[13px] text-zinc-200 leading-relaxed mb-4 p-3 bg-[#111] border border-[#222] rounded-lg">
                    <span className="text-purple-400 font-mono text-[11px] uppercase tracking-wider">Context Memory</span><br/><br/>
                    Act as an expert Design Systems Lead at Acme Corp.<br/>
                    Draft a professional, inspiring email to the product and engineering teams announcing our new design system...
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button className="px-2.5 py-1.5 rounded-md hover:bg-[#222] text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition-colors flex items-center gap-1.5">
                        <span className="flex items-center gap-1"><Zap size={12} /> Regenerate</span>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2.5 py-1.5 rounded-md hover:bg-[#222] text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition-colors flex items-center gap-1">
                        Discard
                        <kbd className="bg-black border border-[#333] rounded px-1 py-0.5 text-[9px] font-mono">⌘D</kbd>
                      </button>
                      <button className="px-3 py-1.5 rounded-md bg-white text-black hover:bg-zinc-200 font-semibold text-[11px] flex items-center gap-1.5 transition-colors">
                        Insert
                        <kbd className="bg-black/10 rounded px-1 py-0.5 text-[9px] font-mono border border-transparent">⌘↵</kbd>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Logo bar ── */}
      <section className="relative z-10 py-14 border-y border-white/[0.05] px-6 bg-[#09090b]/50">
        <p className="text-center text-xs text-zinc-600 uppercase tracking-widest mb-8">
          Works seamlessly across platforms
        </p>
        <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16">
          {["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot", "Midjourney"].map((c) => (
            <span
              key={c}
              className="font-display text-zinc-500 font-semibold text-[16px] tracking-wide hover:text-zinc-300 transition-colors cursor-default"
            >
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* ── Before / After Diff Section ── */}
      <section className="relative z-10 py-28 px-6 md:px-10 max-w-6xl mx-auto bg-[#09090b]">
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="text-xs text-green-400 font-mono tracking-widest uppercase">The Difference</span>
            <h2 className="font-display mt-3 text-4xl md:text-5xl font-extrabold text-white leading-tight">
              Stop settling for average outputs.
            </h2>
            <p className="mt-4 text-zinc-400 max-w-xl mx-auto">
              AI models give you exactly what you ask for. We make sure you're asking for the right thing.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            <div className="bg-[#111] p-8">
              <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="size-2 rounded-full bg-red-400"></span> Before Proenpt
              </div>
              <p className="text-zinc-400 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                write a blog post about our new AI features. make it sound exciting and not too long. it should appeal to developers.
              </p>
              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-xs text-zinc-600">Result: Generic, predictable, marketing-speak.</p>
              </div>
            </div>
            
            <div className="bg-[#161616] p-8">
              <div className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="size-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span> After Proenpt
              </div>
              <p className="text-zinc-200 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                <span className="text-purple-400"># ROLE</span><br/>
                Act as a Senior Developer Advocate at a high-growth SaaS company.<br/><br/>
                <span className="text-cyan-400"># TASK</span><br/>
                Write a 600-word technical blog post announcing our new AI features.<br/><br/>
                <span className="text-pink-400"># CONSTRAINTS</span><br/>
                - Tone: Technical, hype-free, practitioner-focused.<br/>
                - Audience: Full-stack developers.<br/>
                - Focus heavily on the DX (Developer Experience) and API latency.
              </p>
              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-xs text-green-500">Result: Highly targeted, technical, actionable copy.</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-28 px-6 md:px-10 max-w-6xl mx-auto bg-[#09090b]">
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="text-xs text-blue-400 font-mono tracking-widest uppercase">Engineered for Perfection</span>
            <h2 className="font-display mt-3 text-4xl md:text-5xl font-extrabold text-white leading-tight">
              Everything your prompts need.
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Nothing they don&apos;t.
              </span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <ScrollReveal key={f.label} delay={i * 100}>
              <motion.div
                whileHover={{ scale: 1.02, rotateX: 2, rotateY: -2 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative h-full p-6 rounded-2xl border border-promptly-border hover:border-promptly-cyan/50 transition-colors duration-300 cursor-default shadow-glass"
                style={{ background: "var(--color-promptly-surface)", backdropFilter: "blur(10px)", transformPerspective: 1000 }}
              >
                <div
                  className="mb-4 size-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/10"
                >
                  <f.icon size={18} className="text-promptly-cyan group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display text-white font-semibold mb-2">
                  {f.label}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 py-28 px-6 md:px-10 max-w-6xl mx-auto bg-[#09090b]">
        <ScrollReveal>
          <div className="text-center mb-14">
            <span className="text-xs text-purple-400 font-mono tracking-widest uppercase">Pricing</span>
            <h2 className="font-display mt-3 text-4xl md:text-5xl font-extrabold text-white">
              Simple, honest pricing.
            </h2>
            <p className="mt-3 text-zinc-400">Start free, upgrade when you need more power.</p>

            <div
              className="mt-6 inline-flex items-center gap-1 p-1 rounded-full border border-white/10"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {(["monthly", "annual"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setBillingCycle(c)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={
                    billingCycle === c
                      ? {
                          background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                          color: "#fff",
                          boxShadow: "0 0 16px rgba(59,130,246,0.4)",
                        }
                      : { color: "#71717a" }
                  }
                >
                  {c === "annual" ? "Annual (save 20%)" : "Monthly"}
                </button>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {pricingTiers.map((tier, i) => (
            <ScrollReveal key={tier.name} delay={i * 150}>
              <div
                className="relative h-full p-8 rounded-2xl transition-all flex flex-col"
                style={
                  tier.featured
                    ? {
                        background: "rgba(59,130,246,0.06)",
                        border: "1px solid rgba(59,130,246,0.35)",
                        boxShadow: "0 0 50px rgba(59,130,246,0.15), 0 0 120px rgba(59,130,246,0.07)",
                      }
                    : {
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }
                }
              >
                {tier.featured && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold text-white whitespace-nowrap"
                    style={{
                      background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                      boxShadow: "0 0 16px rgba(59,130,246,0.5)",
                    }}
                  >
                    Most popular
                  </span>
                )}

                <p className="text-sm font-semibold text-zinc-300 mb-2">{tier.name}</p>
                <div className="flex items-end gap-1 mb-3">
                  <span className="font-display text-5xl font-extrabold text-white">
                    ${tier.price[billingCycle]}
                  </span>
                  {tier.price.monthly > 0 && (
                    <span className="text-zinc-500 text-sm mb-2">/mo</span>
                  )}
                </div>
                <p className="text-sm text-zinc-400 mb-8 flex-1">{tier.desc}</p>

                <Link
                  href={tier.href}
                  className="block text-center w-full py-3 rounded-xl text-sm font-semibold mb-8 transition-all hover:scale-[1.01]"
                  style={
                    tier.featured
                      ? {
                          background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                          color: "#fff",
                          boxShadow: "0 0 24px rgba(59,130,246,0.45)",
                        }
                      : {
                          background: "rgba(255,255,255,0.07)",
                          color: "#e4e4e7",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }
                  }
                >
                  {tier.cta}
                </Link>

                <ul className="space-y-3">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-3 text-sm text-zinc-300">
                      <div className="size-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <Check size={12} style={{ color: tier.featured ? "#60a5fa" : "#a1a1aa" }} />
                      </div>
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── FAQs ── */}
      <section className="relative z-10 py-28 px-6 max-w-3xl mx-auto bg-[#09090b]">
        <ScrollReveal>
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white">
              Frequently asked questions
            </h2>
          </div>
          <div className="border-t border-white/[0.08]">
            {faqs.map((faq, i) => (
              <Accordion key={i} title={faq.q}>{faq.a}</Accordion>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-24 px-6 text-center overflow-hidden bg-[#09090b]">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="w-[500px] h-[300px] rounded-full opacity-20"
            style={{
              background: "radial-gradient(ellipse, #3b82f6 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
        </div>
        <ScrollReveal>
          <div className="relative max-w-2xl mx-auto">
            <h2 className="font-display text-4xl md:text-5xl font-extrabold text-white mb-4">
              Ready to deploy?
            </h2>
            <p className="text-zinc-400 mb-8">Join thousands of developers shipping faster with Proenpt.</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-base transition-all hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                boxShadow: "0 0 50px rgba(59,130,246,0.5), 0 0 100px rgba(59,130,246,0.2)",
              }}
            >
              Get started for free
              <ArrowRight size={18} />
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-12 px-6 border-t border-white/[0.08] bg-[#09090b]">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="font-display text-lg font-bold text-white mb-4">Proenpt</h3>
            <p className="text-zinc-500 text-sm">Supercharge your AI prompts instantly.</p>
          </div>
          <div>
            <h4 className="font-semibold text-zinc-300 mb-4 text-sm">Product</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link href="#features" className="hover:text-zinc-300 transition-colors">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing</Link></li>
              <li><Link href="/download" className="hover:text-zinc-300 transition-colors">Download</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-zinc-300 mb-4 text-sm">Resources</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link href="#" className="hover:text-zinc-300 transition-colors">Documentation</Link></li>
              <li><Link href="#" className="hover:text-zinc-300 transition-colors">Blog</Link></li>
              <li><Link href="#" className="hover:text-zinc-300 transition-colors">Community</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-zinc-300 mb-4 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link href="#" className="hover:text-zinc-300 transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-zinc-300 transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-8 border-t border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <p>© {new Date().getFullYear()} Proenpt. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="#" className="hover:text-zinc-400 transition-colors">Twitter</Link>
            <Link href="#" className="hover:text-zinc-400 transition-colors">GitHub</Link>
            <Link href="#" className="hover:text-zinc-400 transition-colors">Discord</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
