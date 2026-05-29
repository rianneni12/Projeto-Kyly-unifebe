import { getSessionToken } from './storage'
import type { ApiResult, BoxView, ItemPedido, PickingScanResult, SessionMe, UserTipo } from './types'

const kDemoEnabled = 'kyly.demo.enabled'
const kDemoState = 'kyly.demo.state'

type DemoHistoryRow = {
  id: number
  papeleta: string
  status: string
  criadaEm: string
  fechadaEm: string | null
  operador: string | null
  pecasTotal: number
  pecasPicked: number
}

type DemoState = {
  session: SessionMe
  box: {
    id: number
    papeleta: string
    status: 'ABERTA' | 'FINALIZADA' | 'PARCIAL'
    criadaEm: string
    fechadaEm: string | null
    pedido: { id: number; numeroPedido: string; cliente: string; prioridade: number }
    itens: ItemPedido[]
    erros: number
    usedCodes: Record<string, true>
  }
  history: DemoHistoryRow[]
}

function isDemoEnabled(): boolean {
  if (import.meta.env.VITE_DEMO === '1') return true
  try {
    return localStorage.getItem(kDemoEnabled) === '1'
  } catch {
    return false
  }
}

function setDemoEnabled(v: boolean) {
  try {
    if (v) localStorage.setItem(kDemoEnabled, '1')
    else localStorage.removeItem(kDemoEnabled)
  } catch {
    return
  }
}

function loadDemoState(): DemoState {
  try {
    const raw = localStorage.getItem(kDemoState)
    if (raw) return JSON.parse(raw) as DemoState
  } catch {
    return createDemoState()
  }
  return createDemoState()
}

function saveDemoState(state: DemoState) {
  try {
    localStorage.setItem(kDemoState, JSON.stringify(state))
  } catch {
    return
  }
}

function createDemoState(): DemoState {
  const supervisor: SessionMe['supervisor'] = { id: 1, nome: 'Supervisor Demo', tipo: 'SUPERVISOR' }
  const operador: SessionMe['operador'] = { id: 2, nome: 'Colaborador Demo', tipo: 'OPERADOR' }
  const session: SessionMe = { token: 'demo-token', role: 'SUPERVISOR', supervisor, operador }
  const now = new Date().toISOString()
  const itens: ItemPedido[] = [
    {
      id: 101,
      skuRef: '1000079',
      endereco: 'A1-01-01',
      cor: 'PRETO',
      tamanho: 'M',
      descricao: 'Camiseta Básica',
      qtd_requerida: 2,
      qtd_picked: 0,
      status: 'PENDENTE',
      ordem: 1,
    },
    {
      id: 102,
      skuRef: '1000123',
      endereco: 'A1-01-02',
      cor: 'AZUL',
      tamanho: 'G',
      descricao: 'Moletom Capuz',
      qtd_requerida: 1,
      qtd_picked: 0,
      status: 'PENDENTE',
      ordem: 2,
    },
    {
      id: 103,
      skuRef: '1000081',
      endereco: 'A1-01-03',
      cor: 'BRANCO',
      tamanho: 'P',
      descricao: 'Regata',
      qtd_requerida: 1,
      qtd_picked: 0,
      status: 'PENDENTE',
      ordem: 3,
    },
  ]

  return {
    session,
    box: {
      id: 1,
      papeleta: 'CX-2026-000189',
      status: 'ABERTA',
      criadaEm: now,
      fechadaEm: null,
      pedido: { id: 1, numeroPedido: 'PD-000189', cliente: 'Cliente Demo', prioridade: 1 },
      itens,
      erros: 0,
      usedCodes: {},
    },
    history: [],
  }
}

function demoBoxView(state: DemoState): BoxView {
  const itens = [...state.box.itens].sort((a, b) => a.ordem - b.ordem)
  const pecasTotal = itens.reduce((acc, i) => acc + i.qtd_requerida, 0)
  const pecasColetadas = itens.reduce((acc, i) => acc + i.qtd_picked, 0)
  const itemAtual =
    itens.find((i) => i.status !== 'EM_FALTA' && i.qtd_picked < i.qtd_requerida) ?? null
  const progresso = pecasTotal > 0 ? Math.round((pecasColetadas / pecasTotal) * 100) : 0
  return {
    id: state.box.id,
    papeleta: state.box.papeleta,
    status: state.box.status,
    pedido: state.box.pedido,
    pecasTotal,
    pecasColetadas,
    progresso,
    tempoSegundos: 0,
    erros: state.box.erros,
    itens,
    itemAtual,
  }
}

function isDemoSupervisorCode(code: string) {
  const c = code.trim().toUpperCase()
  return c === 'SUP001' || c === 'SUP-0001'
}

function isDemoOperadorCode(code: string) {
  const c = code.trim().toUpperCase()
  return c === 'USER001' || c === 'OP-010'
}

function isDemoPapeleta(code: string) {
  const c = code.trim().toUpperCase()
  return c === 'CX123456' || c === 'CX-2026-000189'
}

function parseDemoSku(code: string): string | null {
  const raw = code.trim().toUpperCase()
  if (!raw) return null
  const c = raw.startsWith('SKU') ? raw.slice(3) : raw
  const ref = c.replace(/\D+/g, '')
  return ref.length ? ref : null
}

async function httpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSessionToken()
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-session-token': token } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const text = await res.text().catch(() => '')
  const json = (() => {
    if (!text) return null
    try {
      return JSON.parse(text) as ApiResult<T>
    } catch {
      return null
    }
  })()
  if (!json) throw new Error('Resposta inválida do servidor.')
  if (!json.ok) throw new Error(json.error.message)
  return json.data
}

export const api = {
  health: async () => {
    if (isDemoEnabled()) return { status: 'ok' as const }
    return httpFetch<{ status: 'ok' }>('/api/health')
  },
  login: async (body: { supervisorCode: string; operatorCode: string }) => {
    const demo = isDemoSupervisorCode(body.supervisorCode) && isDemoOperadorCode(body.operatorCode)
    if (demo && isDemoEnabled()) {
      const state = loadDemoState()
      saveDemoState(state)
      return { token: state.session.token, supervisor: state.session.supervisor, operador: state.session.operador }
    }
    try {
      const r = await httpFetch<{ token: string; supervisor: any; operador: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (demo) setDemoEnabled(false)
      return r
    } catch (e) {
      if (!demo) throw e
      setDemoEnabled(true)
      const state = loadDemoState()
      saveDemoState(state)
      return { token: state.session.token, supervisor: state.session.supervisor, operador: state.session.operador }
    }
  },
  me: async () => {
    if (isDemoEnabled()) {
      const state = loadDemoState()
      saveDemoState(state)
      return state.session
    }
    return httpFetch<SessionMe>('/api/session/me')
  },
  openBox: async (body: { papeletaCode: string }) => {
    const demo = isDemoPapeleta(body.papeletaCode)
    if (demo && isDemoEnabled()) {
      const state = loadDemoState()
      state.box.papeleta = 'CX-2026-000189'
      saveDemoState(state)
      return demoBoxView(state)
    }
    try {
      const r = await httpFetch<BoxView>('/api/boxes/open', { method: 'POST', body: JSON.stringify(body) })
      if (demo) setDemoEnabled(false)
      return r
    } catch (e) {
      if (!demo) throw e
      setDemoEnabled(true)
      const state = loadDemoState()
      state.box.papeleta = 'CX-2026-000189'
      saveDemoState(state)
      return demoBoxView(state)
    }
  },
  scanPiece: async (body: { boxId: number; code: string }) => {
    if (!isDemoEnabled()) {
      return httpFetch<PickingScanResult>('/api/picking/scan', { method: 'POST', body: JSON.stringify(body) })
    }
    const state = loadDemoState()
    if (body.boxId !== state.box.id) throw new Error('Caixa não encontrada.')
    if (state.box.status !== 'ABERTA') throw new Error('Caixa já está encerrada.')
    const ref = parseDemoSku(body.code)
    if (!ref) {
      state.box.erros += 1
      saveDemoState(state)
      throw new Error('SKU não pertence à caixa.')
    }
    if (state.box.usedCodes[body.code.trim().toUpperCase()]) {
      state.box.erros += 1
      saveDemoState(state)
      throw new Error('Peça já utilizada.')
    }
    const item = state.box.itens.find((i) => i.skuRef === ref) ?? null
    if (!item || item.status === 'EM_FALTA') {
      state.box.erros += 1
      saveDemoState(state)
      throw new Error('SKU não pertence à caixa.')
    }
    if (item.qtd_picked >= item.qtd_requerida) {
      state.box.erros += 1
      saveDemoState(state)
      throw new Error('Peça já utilizada.')
    }

    state.box.usedCodes[body.code.trim().toUpperCase()] = true
    item.qtd_picked += 1
    if (item.qtd_picked >= item.qtd_requerida) item.status = 'CONCLUIDO'
    const view = demoBoxView(state)
    saveDemoState(state)
    const updatedItem = view.itens.find((i) => i.id === item.id) ?? null
    const done = updatedItem ? updatedItem.qtd_picked >= updatedItem.qtd_requerida : false
    return {
      result: done ? 'SKU_CONCLUIDA' : 'PARCIAL_OK',
      box: view,
      item: updatedItem,
      nextItem: view.itemAtual,
    } satisfies PickingScanResult
  },
  markMissing: async (body: { boxId: number; itemId: number }) => {
    if (!isDemoEnabled()) {
      return httpFetch<{ box: BoxView; alternatives: any[] }>('/api/picking/missing', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    }
    const state = loadDemoState()
    if (body.boxId !== state.box.id) throw new Error('Caixa não encontrada.')
    const item = state.box.itens.find((i) => i.id === body.itemId) ?? null
    if (!item) throw new Error('Item não encontrado.')
    item.status = 'EM_FALTA'
    const alternatives = [
      { endereco: 'A1-09-01', qtdDisponivel: 4 },
      { endereco: 'A2-02-03', qtdDisponivel: 2 },
    ].filter((a) => String(a.endereco) !== item.endereco)
    const view = demoBoxView(state)
    saveDemoState(state)
    return { box: view, alternatives }
  },
  finalizeBox: async (body: { boxId: number; mode: 'FINAL' | 'PARCIAL' }) => {
    if (!isDemoEnabled()) {
      return httpFetch<{ boxId: number; status: string }>('/api/boxes/finalize', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    }
    const state = loadDemoState()
    if (body.boxId !== state.box.id) throw new Error('Caixa não encontrada.')
    if (state.box.status !== 'ABERTA') throw new Error('Caixa já está encerrada.')
    state.box.status = body.mode === 'FINAL' ? 'FINALIZADA' : 'PARCIAL'
    state.box.fechadaEm = new Date().toISOString()
    const view = demoBoxView(state)
    const row: DemoHistoryRow = {
      id: state.history.length ? Math.max(...state.history.map((r) => r.id)) + 1 : 1,
      papeleta: view.papeleta,
      status: state.box.status,
      criadaEm: state.box.criadaEm,
      fechadaEm: state.box.fechadaEm,
      operador: state.session.operador.nome,
      pecasTotal: view.pecasTotal,
      pecasPicked: view.pecasColetadas,
    }
    state.history = [row, ...state.history].slice(0, 100)
    saveDemoState(state)
    return { boxId: state.box.id, status: body.mode }
  },
  history: async () => {
    if (isDemoEnabled()) {
      const state = loadDemoState()
      saveDemoState(state)
      return state.history
    }
    return httpFetch<any[]>('/api/history')
  },
  metricsSupervisor: async () => {
    if (isDemoEnabled()) {
      return [
        { operador: 'Colaborador Demo', caixas: 3, pecas: 12, erros: 1, tempoMedioSeg: 95 },
        { operador: 'Operador 02', caixas: 2, pecas: 8, erros: 0, tempoMedioSeg: 110 },
      ]
    }
    return httpFetch<any[]>('/api/metrics/supervisor')
  },
  adminUsers: async () => {
    if (isDemoEnabled()) {
      const users: Array<{ id: number; nome: string; cracha_code: string; tipo: UserTipo; ativo: number }> = [
        { id: 1, nome: 'Supervisor Demo', cracha_code: 'SUP001', tipo: 'SUPERVISOR', ativo: 1 },
        { id: 2, nome: 'Colaborador Demo', cracha_code: 'USER001', tipo: 'OPERADOR', ativo: 1 },
      ]
      return users
    }
    return httpFetch<any[]>('/api/admin/users')
  },
  adminSkus: async () => {
    if (isDemoEnabled()) {
      return [
        { id: 1, ref: '1000079', cor: 'PRETO', tamanho: 'M', descricao: 'Camiseta Básica', saldo: 10 },
        { id: 2, ref: '1000123', cor: 'AZUL', tamanho: 'G', descricao: 'Moletom Capuz', saldo: 5 },
        { id: 3, ref: '1000081', cor: 'BRANCO', tamanho: 'P', descricao: 'Regata', saldo: 8 },
      ]
    }
    return httpFetch<any[]>('/api/admin/skus')
  },
  adminAddresses: async () => {
    if (isDemoEnabled()) {
      return [
        { id: 1, sku_ref: '1000079', endereco: 'A1-01-01', qtd_disponivel: 10 },
        { id: 2, sku_ref: '1000123', endereco: 'A1-01-02', qtd_disponivel: 5 },
        { id: 3, sku_ref: '1000081', endereco: 'A1-01-03', qtd_disponivel: 8 },
      ]
    }
    return httpFetch<any[]>('/api/admin/addresses')
  },
}
