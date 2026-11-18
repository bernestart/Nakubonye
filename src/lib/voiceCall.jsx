import { createContext, useContext, useState } from 'react'

const VoiceCallCtx = createContext(null)

export function VoiceCallProvider({ children }) {
  const [activeCall, setActiveCall] = useState(null)
  return (
    <VoiceCallCtx.Provider value={{ activeCall, setActiveCall }}>
      {children}
    </VoiceCallCtx.Provider>
  )
}
export const useVoiceCall = () => useContext(VoiceCallCtx)
