import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

const WalletCtx = createContext(null)

export function WalletProvider({ children }) {
  const { session } = useAuth()
  const [balance, setBalance] = useState(0)
  const [lifetimeEarned, setLifetimeEarned] = useState(0)
  const [lifetimeSpent, setLifetimeSpent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!session?.user?.id) {
      setBalance(0); setLifetimeEarned(0); setLifetimeSpent(0); setLoading(false)
      return
    }
    setLoading(true); setError('')
    const { data, error: rpcErr } = await supabase.rpc('get_my_coin_wallet')
    if (rpcErr) { setError(rpcErr.message); setLoading(false); return }
    const row = Array.isArray(data) ? data[0] : data
    setBalance(Number(row?.balance ?? 0))
    setLifetimeEarned(Number(row?.lifetime_earned ?? 0))
    setLifetimeSpent(Number(row?.lifetime_spent ?? 0))
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { refresh() }, [refresh])

  // Realtime: keep balance fresh across tabs / devices
  useEffect(() => {
    if (!session?.user?.id) return
    const ch = supabase
      .channel('wallet-' + session.user.id)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'coin_wallets', filter: 'user_id=eq.' + session.user.id },
        (payload) => {
          setBalance(Number(payload.new.balance ?? 0))
          setLifetimeEarned(Number(payload.new.lifetime_earned ?? 0))
          setLifetimeSpent(Number(payload.new.lifetime_spent ?? 0))
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.user?.id])

  // One-time welcome bonus claim, fires once per user ever
  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false
    ;(async () => {
      // Welcome bonus — only succeeds once, ever
      await supabase.rpc('claim_welcome_bonus')

      // Daily login bonus — succeeds once per UTC day, silent
      const { data: daily } = await supabase.rpc('claim_daily_login')

      if (cancelled) return
      refresh()

      // If the daily claim returned granted=false, no refresh needed
      // (nothing changed), but refresh() above handles either case.
      void daily
    })()
    return () => { cancelled = true }
  }, [session?.user?.id, refresh])

  const value = { balance, lifetimeEarned, lifetimeSpent, loading, error, refresh }
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletCtx)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}
