import type { BoxView, SessionMe } from './types'

const k = {
  sessionToken: 'kyly.sessionToken',
  sessionMe: 'kyly.sessionMe',
  currentBox: 'kyly.currentBox',
} as const

export function getSessionToken(): string | null {
  return localStorage.getItem(k.sessionToken)
}

export function setSessionToken(token: string | null) {
  if (!token) localStorage.removeItem(k.sessionToken)
  else localStorage.setItem(k.sessionToken, token)
}

export function getSessionMe(): SessionMe | null {
  const raw = localStorage.getItem(k.sessionMe)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionMe
  } catch {
    return null
  }
}

export function setSessionMe(me: SessionMe | null) {
  if (!me) localStorage.removeItem(k.sessionMe)
  else localStorage.setItem(k.sessionMe, JSON.stringify(me))
}

export function getCurrentBox(): BoxView | null {
  const raw = localStorage.getItem(k.currentBox)
  if (!raw) return null
  try {
    return JSON.parse(raw) as BoxView
  } catch {
    return null
  }
}

export function setCurrentBox(box: BoxView | null) {
  if (!box) localStorage.removeItem(k.currentBox)
  else localStorage.setItem(k.currentBox, JSON.stringify(box))
}

