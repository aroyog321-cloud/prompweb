'use client'

import { useEffect, useState, useCallback } from 'react'

export function AuthSyncComponent({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<'pending' | 'synced' | 'missing' | 'failed'>('pending')
  const [retryCount, setRetryCount] = useState(0)

  const triggerSync = useCallback(() => {
    setStatus('pending')
    setRetryCount(prev => prev + 1)
  }, [])

  useEffect(() => {
    if (!accessToken) {
      setStatus('missing')
      return
    }

    let isSynced = false;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      
      if (event.data?.type === "PROMPTLY_EXTENSION_READY") {
        window.postMessage({ type: "PROMPTLY_AUTH_TOKEN", token: accessToken }, window.location.origin)
      } else if (event.data?.type === "PROMPTLY_AUTH_SYNCED") {
        isSynced = true;
        setStatus('synced')
      }
    }

    window.addEventListener("message", handleMessage)
    
    // Initial ping
    window.postMessage({ type: "PROMPTLY_AUTH_PING" }, window.location.origin)

    let attempts = 0;
    const maxAttempts = 5; // 10 seconds total
    
    const interval = setInterval(() => {
      if (isSynced) {
        clearInterval(interval)
        return
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval)
        setStatus('failed')
      } else {
        window.postMessage({ type: "PROMPTLY_AUTH_PING" }, window.location.origin)
      }
    }, 2000)

    return () => {
      window.removeEventListener("message", handleMessage)
      clearInterval(interval)
    }
  }, [accessToken, retryCount])

  if (status === 'missing') return null;

  return (
    <div className={`mt-4 flex items-center justify-between gap-2 px-4 py-3 rounded-lg text-sm font-medium ${status === 'synced' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : status === 'failed' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
      <div className="flex items-center gap-2">
        {status === 'synced' ? (
          <>
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Extension Automatically Authenticated!
          </>
        ) : status === 'failed' ? (
          <>
            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Extension not found or failed to sync.
          </>
        ) : (
          <>
            <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Waiting for extension to sync authentication...
          </>
        )}
      </div>
      {status === 'failed' && (
        <button 
          onClick={triggerSync}
          className="px-3 py-1 text-xs font-semibold rounded bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors"
        >
          Retry Sync
        </button>
      )}
    </div>
  )
}
