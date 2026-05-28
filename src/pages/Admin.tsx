import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../app/api'
import { Button, Card, CardBody, Header, Kbd, Screen } from '../app/ui'

type UserRow = { id: number; nome: string; cracha_code: string; tipo: string; ativo: number }
type SkuRow = { id: number; ref: string; cor: string; tamanho: string; descricao: string; saldo: number }
type AddressRow = { id: number; sku_ref: string; endereco: string; qtd_disponivel: number }

export function AdminPage() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'USUARIOS' | 'SKUS' | 'ENDERECOS'>('USUARIOS')
  const [users, setUsers] = useState<UserRow[]>([])
  const [skus, setSkus] = useState<SkuRow[]>([])
  const [addresses, setAddresses] = useState<AddressRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const p =
      tab === 'USUARIOS'
        ? (api as any).adminUsers().then(setUsers)
        : tab === 'SKUS'
          ? (api as any).adminSkus().then(setSkus)
          : (api as any).adminAddresses().then(setAddresses)

    Promise.resolve(p)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar.'))
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <Screen>
      <Header title="ADMIN" subtitle="Cadastros (demo)" right={<Kbd tone="info">ADM</Kbd>} />

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className={tab === 'USUARIOS' ? activeTab : tabBtn}
          onClick={() => setTab('USUARIOS')}
        >
          Usuários
        </button>
        <button
          type="button"
          className={tab === 'SKUS' ? activeTab : tabBtn}
          onClick={() => setTab('SKUS')}
        >
          SKUs
        </button>
        <button
          type="button"
          className={tab === 'ENDERECOS' ? activeTab : tabBtn}
          onClick={() => setTab('ENDERECOS')}
        >
          Endereços
        </button>
      </div>

      <Card className="mt-3">
        <CardBody>
          {loading ? (
            <div className="text-[13px] font-semibold text-app-muted">Carregando...</div>
          ) : error ? (
            <div className="text-[13px] font-semibold text-brand-red">{error}</div>
          ) : tab === 'USUARIOS' ? (
            <ListUsers rows={users} />
          ) : tab === 'SKUS' ? (
            <ListSkus rows={skus} />
          ) : (
            <ListAddresses rows={addresses} />
          )}

          <div className="mt-4">
            <Button variant="ghost" onClick={() => nav('/menu')}>
              Voltar ao menu
            </Button>
          </div>
        </CardBody>
      </Card>
    </Screen>
  )
}

const tabBtn =
  'rounded-xl border border-app-border bg-black/20 px-3 py-3 text-[12px] font-extrabold uppercase tracking-[0.12em] text-app-muted'
const activeTab =
  'rounded-xl border border-brand-primary/40 bg-brand-primary/15 px-3 py-3 text-[12px] font-extrabold uppercase tracking-[0.12em] text-brand-primary'

function ListUsers({ rows }: { rows: UserRow[] }) {
  if (!rows.length) return <div className="text-[13px] font-semibold text-app-muted">Sem dados.</div>
  return (
    <div className="grid gap-2">
      {rows.map((u) => (
        <div key={u.id} className="rounded-xl border border-app-border bg-app-panel2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-extrabold text-app-text">{u.nome}</div>
              <div className="mt-1 text-[12px] font-semibold text-app-muted">
                {u.cracha_code} • {u.tipo}
              </div>
            </div>
            <Kbd tone={u.ativo ? 'success' : 'danger'}>{u.ativo ? 'ATIVO' : 'INATIVO'}</Kbd>
          </div>
        </div>
      ))}
    </div>
  )
}

function ListSkus({ rows }: { rows: SkuRow[] }) {
  if (!rows.length) return <div className="text-[13px] font-semibold text-app-muted">Sem dados.</div>
  return (
    <div className="grid gap-2">
      {rows.map((s) => (
        <div key={s.id} className="rounded-xl border border-app-border bg-app-panel2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-extrabold text-app-text">{s.ref}</div>
              <div className="mt-1 text-[12px] font-semibold text-app-muted">
                {s.descricao} • {s.cor} • {s.tamanho}
              </div>
            </div>
            <Kbd tone={s.saldo > 0 ? 'success' : 'danger'}>{s.saldo}</Kbd>
          </div>
        </div>
      ))}
    </div>
  )
}

function ListAddresses({ rows }: { rows: AddressRow[] }) {
  if (!rows.length) return <div className="text-[13px] font-semibold text-app-muted">Sem dados.</div>
  return (
    <div className="grid gap-2">
      {rows.map((a) => (
        <div key={a.id} className="rounded-xl border border-app-border bg-app-panel2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] font-extrabold text-app-text">{a.endereco}</div>
              <div className="mt-1 text-[12px] font-semibold text-app-muted">{a.sku_ref}</div>
            </div>
            <Kbd tone={a.qtd_disponivel > 0 ? 'success' : 'danger'}>{a.qtd_disponivel}</Kbd>
          </div>
        </div>
      ))}
    </div>
  )
}

