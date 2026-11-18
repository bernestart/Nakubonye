import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './auth'
import { API_BASE_URL } from './api'

const SettingsCtx = createContext(null)

export function SettingsProvider({ children }) {
  const { session } = useAuth()
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (!session?.user?.id) return;
    // TODO: Wire to Neon /api/settings
  }, [session?.user?.id])

  return (
    <SettingsCtx.Provider value={{ settings, loading, setSettings }}>
      {children}
    </SettingsCtx.Provider>
  )
}
export const useSettings = () => useContext(SettingsCtx)

// Keep the UI constants (used in PrivacySettings)
export const AUDIENCE_LEVELS = ['Public', 'Friends', 'Only Me']
export const PROFILE_VISIBILITY_LEVELS = ['Everyone', 'Friends of Friends', 'Friends', 'Only Me']
export const LOCATION_LEVELS = ['Always', 'While Using App', 'Never']
export const REQUEST_LEVELS = ['Everyone', 'Friends of Friends', 'Friends']
export const TAG_LEVELS = ['Everyone', 'Friends of Friends', 'Friends', 'Only Me']
export const VISIBILITY_LEVELS = ['Public', 'Friends', 'Custom']
