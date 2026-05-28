import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../app/api'
import { Button, Card, CardBody, Header, Kbd, Screen } from '../app/ui'

type Row = {
  id: number
  papeleta: string
  status: string
  criadaEm: string
  fechadaEm: string | null
  operador: string | null
  pecasTotal: number
  pecasPicked: number
}

export function HistoryPage() {
  const nav = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .history()
      .then((r) => setRows(r as any))
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Screen>
      <Header title="HISTÓRICO" subtitle="Caixas abertas, parciais e finalizadas" right={<Kbd tone="info">LOG</Kbd>} />

      <Card>
        <CardBody>
          {loading ? (
            <div className="text-[13px] font-semibold text-app-muted">Carregando...</div>
          ) : error ? (
            <div className="text-[13px] font-semibold text-brand-red">{error}</div>
          ) : !rows.length ? (
            <div className="text-[13px] font-semibold text-app-muted">Sem registros.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 md:gap-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-app-border bg-app-panel2 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
                        {r.papeleta}
                      </div>
                      <div className="mt-1 text-[13px] font-semibold text-app-text">
                        Operador: {r.operador ?? '—'}
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-app-muted">
                        {new Date(r.criadaEm).toLocaleString()}
                      </div>
                    </div>
                    <Kbd tone={r.status === 'FINALIZADA' ? 'success' : r.status === 'PARCIAL' ? 'warning' : 'info'}>
                      {r.status}
                    </Kbd>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] font-semibold text-app-muted">
                    <div className="rounded-lg border border-app-border bg-black/20 p-2">
                      Total: <span className="text-app-text tabular-nums">{r.pecasTotal}</span>
                    </div>
                    <div className="rounded-lg border border-app-border bg-black/20 p-2">
                      Coletadas:{' '}
                      <span className="text-app-text tabular-nums">{r.pecasPicked}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
