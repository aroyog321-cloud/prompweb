'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function AuthSyncComponent({ 
  accessToken, 
  refreshToken,
  supabaseUrl,
  supabaseAnonKey,
  onStatusChange 
}: { 
  accessToken: string, 
  refreshToken: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  onStatusChange?: (status: 'pending' | 'synced' | 'missing' | 'failed') => void 
}) {
  const [status, setStatus] = useState<'pending' | 'synced' | 'missing' | 'failed'>(!accessToken ? 'missing' : 'pending')
  const [retryCount, setRetryCount] = useState(0)

  const triggerSync = useCallback(() => {
    setStatus('pending')
    onStatusChange?.('pending')
    setRetryCount(prev => prev + 1)
  }, [onStatusChange])

  useEffect(() => {
    if (!accessToken) {
      // status is already initialized to missing
      onStatusChange?.('missing')
      return
    }

    let isSynced = false;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      
      if (event.data?.type === "PROMPTLY_EXTENSION_READY") {
        if (accessToken) {
          const timestamp = Date.now();
          const nonce = Math.random().toString(36).substring(2) + timestamp.toString(36);
          window.postMessage({ 
            type: "PROMPTLY_AUTH_TOKEN", 
            token: accessToken, 
            refreshToken,
            supabaseUrl,
            supabaseAnonKey,
            timestamp, 
            nonce 
          }, window.location.origin)
        }
      } else if (event.data?.type === "PROMPTLY_AUTH_SYNCED") {
        isSynced = true;
        setStatus('synced')
        onStatusChange?.('synced')
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
        onStatusChange?.('failed')
      } else {
        window.postMessage({ type: "PROMPTLY_AUTH_PING" }, window.location.origin)
      }
    }, 2000)

    return () => {
      window.removeEventListener("message", handleMessage)
      clearInterval(interval)
    }
  }, [accessToken, retryCount, onStatusChange])

  return null;
}
