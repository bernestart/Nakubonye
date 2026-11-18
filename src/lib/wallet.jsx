import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './auth'
import { API_BASE_URL } from './api'

const WalletCtx = createContext(null)

export function WalletProvider({ children }) {
  const { session } = useAuth()
  const [balance, setBalance] = useState(0)
  const [lifetimeEarned, setLifetimeEarned] = useState(0)
  const [lifetimeSpent, setLifetimeSpent] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!session?.user?.id) {
      setBalance(0); setLifetimeEarned(0); setLifetimeSpent(0); setLoading(false)
      return
    }
    // TODO: Create /api/wallet route on Cloudflare Worker
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { refresh() }, [refresh])

  return (
    <WalletCtx.Provider value={{ balance, lifetimeEarned, lifetimeSpent, loading, error, refresh }}>
      {children}
    </WalletCtx.Provider>
  )
}
export const useWallet = () => useContext(WalletCtx)
