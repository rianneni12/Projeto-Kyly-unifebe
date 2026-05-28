import { getSessionToken } from './storage'
import type { ApiResult } from './types'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSessionToken()
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-session-token': token } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const json = (await res.json().catch(() => null)) as ApiResult<T> | null
  if (!json) throw new Error('Resposta inválida do servidor.')
  if (!json.ok) throw new Error(json.error.message)
  return json.data
}

export const api = {
  health: () => apiFetch<{ status: 'ok' }>('/api/health'),
  login: (body: { supervisorCode: string; operatorCode: string }) =>
    apiFetch<{ token: string; supervisor: any; operador: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: () => apiFetch<any>('/api/session/me'),
  openBox: (body: { papeletaCode: string }) =>
    apiFetch<any>('/api/boxes/open', { method: 'POST', body: JSON.stringify(body) }),
  scanPiece: (body: { boxId: number; code: string }) =>
    apiFetch<any>('/api/picking/scan', { method: 'POST', body: JSON.stringify(body) }),
  markMissing: (body: { boxId: number; itemId: number }) =>
    apiFetch<any>('/api/picking/missing', { method: 'POST', body: JSON.stringify(body) }),
  finalizeBox: (body: { boxId: number; mode: 'FINAL' | 'PARCIAL' }) =>
    apiFetch<any>('/api/boxes/finalize', { method: 'POST', body: JSON.stringify(body) }),
  history: () => apiFetch<any[]>('/api/history'),
  metricsSupervisor: () => apiFetch<any[]>('/api/metrics/supervisor'),
  adminUsers: () => apiFetch<any[]>('/api/admin/users'),
  adminSkus: () => apiFetch<any[]>('/api/admin/skus'),
  adminAddresses: () => apiFetch<any[]>('/api/admin/addresses'),
}
