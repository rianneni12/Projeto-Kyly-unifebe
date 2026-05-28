import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from './api'
import { getCurrentBox, getSessionMe, getSessionToken, setCurrentBox, setSessionMe, setSessionToken } from './storage'
import type { BoxView, SessionMe } from './types'

type AppState = {
  session: SessionMe | null
  box: BoxView | null
  setBox: (b: BoxView | null) => void
  logout: () => void
  refreshMe: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionMe | null>(() => getSessionMe())
  const [box, _setBox] = useState<BoxView | null>(() => getCurrentBox())

  useEffect(() => {
    setSessionMe(session)
  }, [session])

  useEffect(() => {
    setCurrentBox(box)
  }, [box])

  useEffect(() => {
    const token = getSessionToken()
    if (!token) return
    if (session?.token === token) return
    refreshMe().catch(() => {
      setSessionToken(null)
      setSession(null)
    })
  }, [])

  async function refreshMe() {
    const token = getSessionToken()
    if (!token) return
    const me = (await api.me()) as SessionMe
    setSession(me)
    setSessionToken(me.token)
  }

  function setBox(box: BoxView | null) {
    _setBox(box)
  }

  function logout() {
    setSessionToken(null)
    setSession(null)
    _setBox(null)
  }

  const value = useMemo(
    () => ({ session, box, setBox, logout, refreshMe }),
    [session, box],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('AppProvider ausente.')
  return v
}
