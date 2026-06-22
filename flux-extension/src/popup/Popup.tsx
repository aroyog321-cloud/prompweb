import React, { useEffect, useState, useId } from "react";
import { getSettings, setSettings as persistSettings } from "../lib/storage";
import { ContextProfile, PromptlySettings, PROMPT_MODES, REWRITE_LEVELS, PromptMode, RewriteLevel } from '@promptly/types';

export const Popup: React.FC = () => {
  const [settings, setSettings] = useState<PromptlySettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'context'>('general');
  const [apiPlanData, setApiPlanData] = useState<{ tier: string, total_requests_today: number } | null>(null);

  useEffect(() => {
    const fetchMe = (s: PromptlySettings) => {
      chrome.storage.local.get(['apiPlanCache'], (res) => {
        const now = Date.now();
        if (res.apiPlanCache && res.apiPlanCache.expiresAt > now) {
          setApiPlanData(res.apiPlanCache.data);
          return;
        }

        fetch(`${s.apiBaseUrl}/api/me`, {
          headers: { 'Authorization': `Bearer ${s.accessToken}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.tier) {
            const planData = { tier: data.tier, total_requests_today: data.total_requests_today };
            setApiPlanData(planData);
            chrome.storage.local.set({ 
              apiPlanCache: { data: planData, expiresAt: now + 10 * 1000 } 
            });
            if (data.contextProfile) {
              const currentCtx = s.contextProfile || {};
              const isEmpty = Object.values(currentCtx).every(v => !v);
              if (isEmpty) {
                persistSettings({ contextProfile: data.contextProfile }).then(setSettings);
              }
            }
          }
        })
        .catch(console.error);
      });
    };

    getSettings().then((s) => {
      setSettings(s);
      if (s?.accessToken && s?.apiBaseUrl) {
        fetchMe(s);
      }
    });

    const onMessage = (msg: any) => {
      if (msg?.type === "PROMPTLY_PLAN_UPDATED") {
        getSettings().then(s => {
          if (s?.accessToken && s?.apiBaseUrl) fetchMe(s);
        });
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  const update = async (partial: Partial<PromptlySettings>) => {
    const next = await persistSettings(partial);
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const updateContext = (partial: Partial<ContextProfile>) => {
    if (!settings) return;
    update({ contextProfile: { ...settings.contextProfile, ...partial } });
  };

  if (!settings) {
    return <div className="p-6 text-[13px] text-[var(--text-secondary)] animate-pulse">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-4 p-5 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full shadow-lg border border-[var(--border-subtle)]" style={{ background: 'var(--surface-elevated)' }}>
              <img src="/promptly-orb.png" alt="Proenpt Orb" className="w-full h-full object-cover scale-[1.1]" />
            </div>
            <div>
              <h1 className="font-display text-[15px] font-semibold text-[var(--text-primary)] leading-none mb-1">Proenpt</h1>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">Prompt Optimizer</p>
            </div>
          </div>
          <div className="h-4">
            {saved && <span className="text-[11px] font-medium text-[var(--text-tertiary)] transition-opacity">Saved</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="relative flex w-full p-1 bg-[var(--surface-floating)] border border-[var(--border-subtle)] rounded-lg mt-2">
          <div 
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[var(--surface-base)] border border-[var(--border-strong)] rounded-md shadow-sm transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: activeTab === 'general' ? 'translateX(0)' : 'translateX(calc(100% + 0px))' }}
          />
          {(['general', 'context'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative z-10 flex-1 py-1.5 text-[12px] font-medium transition-colors duration-300 ${
                activeTab === tab 
                  ? 'text-[var(--text-primary)]' 
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5 pb-6 custom-scrollbar">
        {activeTab === 'general' && (
          <div className="space-y-5">
            <section className="space-y-3 animate-in fade-in" style={{ opacity: 0, animationDelay: '0ms' }}>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Defaults</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Mode">
                  <select
                    className="select"
                    value={settings.defaultMode}
                    onChange={(e) => update({ defaultMode: e.target.value as PromptMode })}
                    aria-label="Default prompt mode"
                  >
                    {PROMPT_MODES.map((m: { value: string, label: string }) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Rewrite level">
                  <select
                    className="select"
                    value={settings.defaultLevel}
                    onChange={(e) => update({ defaultLevel: e.target.value as RewriteLevel })}
                    aria-label="Default rewrite level"
                  >
                    {REWRITE_LEVELS.map((l: { value: string, label: string }) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>
            
            <div className="minimal-divider animate-in fade-in" style={{ opacity: 0, animationDelay: '50ms' }} />
            
            <section className="space-y-3 animate-in fade-in" style={{ opacity: 0, animationDelay: '100ms' }}>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Preferences</h2>
              <div className="flex items-center justify-between promptly-card p-3">
                <div>
                  <p className="text-[12px] font-medium text-[var(--text-primary)]">Keyboard shortcut</p>
                  <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5">Open optimizer from any input</p>
                </div>
                <kbd className="rounded bg-[var(--surface-base)] border border-[var(--border-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                  Ctrl+Shift+P
                </kbd>
              </div>
            </section>
            
            <div className="minimal-divider animate-in fade-in" style={{ opacity: 0, animationDelay: '150ms' }} />
            
            <section className="space-y-3 animate-in fade-in" style={{ opacity: 0, animationDelay: '200ms' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Your Plan</h2>
                <span className="text-[10px] font-semibold bg-[var(--surface-floating)] border border-[var(--border-subtle)] px-2 py-0.5 rounded text-[var(--text-secondary)]">
                  {apiPlanData?.tier?.toUpperCase() || "FREE"}
                </span>
              </div>
              <div className="promptly-card p-3.5 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-transparent"></div>
                <div className="flex justify-between items-end">
                  <p className="text-[12px] font-medium text-[var(--text-primary)]">
                    {apiPlanData?.total_requests_today || 0} <span className="text-[var(--text-tertiary)]">/ {apiPlanData?.tier === 'expert' ? '1000' : apiPlanData?.tier === 'pro' ? '25' : '10'} optimizations</span>
                  </p>
                </div>
                <div className="h-1.5 w-full bg-[var(--surface-base)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full" style={{ width: `${Math.min(100, Math.round(((apiPlanData?.total_requests_today || 0) / (apiPlanData?.tier === 'expert' ? 1000 : apiPlanData?.tier === 'pro' ? 25 : 10)) * 100))}%` }}></div>
                </div>
                {apiPlanData?.tier !== 'expert' && (
                  <button 
                    onClick={() => window.open(`${settings.apiBaseUrl}/dashboard`, "_blank")}
                    className="w-full mt-2 bg-[var(--text-primary)] text-[var(--surface-base)] font-semibold text-[11px] py-2 rounded-md hover:opacity-90 transition-opacity">
                    Upgrade Plan
                  </button>
                )}
                {apiPlanData?.tier === 'expert' && (
                  <button 
                    onClick={() => window.open(`${settings.apiBaseUrl}/dashboard`, "_blank")}
                    className="w-full mt-2 bg-[var(--surface-floating)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold text-[11px] py-2 rounded-md hover:text-[var(--text-primary)] transition-colors">
                    Manage Plan
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'context' && (
          <div className="space-y-5">
            <section className="space-y-4 animate-in fade-in" style={{ opacity: 0, animationDelay: '0ms' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Context Memory</h2>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Woven into every optimization.</p>
                </div>
                <Toggle
                  checked={settings.contextInjectionEnabled}
                  onChange={(checked) => update({ contextInjectionEnabled: checked })}
                  ariaLabel="Enable Context Memory"
                />
              </div>
              
              <div className={`transition-opacity duration-300 ${!settings.contextInjectionEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Company">
                    <input className="input" value={settings.contextProfile.companyName ?? ""} onChange={(e) => updateContext({ companyName: e.target.value })} placeholder="Acme Inc." />
                  </Field>
                  <Field label="Industry">
                    <input className="input" value={settings.contextProfile.industry ?? ""} onChange={(e) => updateContext({ industry: e.target.value })} placeholder="SaaS" />
                  </Field>
                  <Field label="Audience">
                    <input className="input" value={settings.contextProfile.audience ?? ""} onChange={(e) => updateContext({ audience: e.target.value })} placeholder="Founders" />
                  </Field>
                  <Field label="Brand tone">
                    <input className="input" value={settings.contextProfile.brandTone ?? ""} onChange={(e) => updateContext({ brandTone: e.target.value })} placeholder="Minimal" />
                  </Field>
                  <Field label="Style">
                    <input className="input" value={settings.contextProfile.writingStyle ?? ""} onChange={(e) => updateContext({ writingStyle: e.target.value })} placeholder="Direct" />
                  </Field>
                  <Field label="Website">
                    <input className="input" value={settings.contextProfile.websiteUrl ?? ""} onChange={(e) => updateContext({ websiteUrl: e.target.value })} placeholder="acme.com" />
                  </Field>
                </div>
              </div>
            </section>
          </div>
        )}


      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const id = useId();
  const child = React.isValidElement(children) && (children.type === 'input' || children.type === 'select')
    ? React.cloneElement(children as React.ReactElement, { id })
    : children;
    
  return (
    <div className="block">
      <label htmlFor={id} className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5">
        {label}
      </label>
      {child}
    </div>
  );
};

const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; ariaLabel?: string }> = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent outline-none transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${checked ? "bg-[var(--text-primary)]" : "bg-[var(--surface-floating)] border-[var(--border-subtle)]"}`}
  >
    <span
      className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow ring-0 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${checked ? "translate-x-4 bg-[var(--surface-base)]" : "translate-x-0.5 bg-[var(--text-tertiary)]"}`}
    />
  </button>
);
