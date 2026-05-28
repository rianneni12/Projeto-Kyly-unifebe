export type UserTipo = 'OPERADOR' | 'SUPERVISOR' | 'ADMIN'

export type SessionMe = {
  token: string
  role: UserTipo
  supervisor: { id: number; nome: string; tipo: UserTipo }
  operador: { id: number; nome: string; tipo: UserTipo }
}

export type Pedido = {
  id: number
  numeroPedido: string
  cliente: string
  prioridade: number
}

export type ItemPedido = {
  id: number
  skuRef: string
  endereco: string
  cor: string
  tamanho: string
  descricao: string
  qtd_requerida: number
  qtd_picked: number
  status: 'PENDENTE' | 'EM_FALTA' | 'CONCLUIDO'
  ordem: number
}

export type BoxView = {
  id: number
  papeleta: string
  status: 'ABERTA' | 'FINALIZADA' | 'PARCIAL' | string
  pedido: Pedido | null
  pecasTotal: number
  pecasColetadas: number
  progresso: number
  tempoSegundos: number
  erros: number
  itens: ItemPedido[]
  itemAtual: ItemPedido | null
}

export type PickingScanResult = {
  result: 'PARCIAL_OK' | 'SKU_CONCLUIDA'
  box: BoxView
  item: ItemPedido | null
  nextItem: ItemPedido | null
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

