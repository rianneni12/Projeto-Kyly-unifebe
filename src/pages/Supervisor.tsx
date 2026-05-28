import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../app/api'
import { Button, Card, CardBody, Header, Kbd, Screen } from '../app/ui'

type Row = { operador: string; caixas: number; pecas: number; erros: number; tempoMedioSeg: number }

export function SupervisorPage() {
  const nav = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .metricsSupervisor()
      .then((r) => setRows(r as any))
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Screen>
      <Header title="SUPERVISOR" subtitle="Produtividade e ranking (demo)" right={<Kbd tone="info">KPI</Kbd>} />

      <Card>
        <CardBody>
          {loading ? (
            <div className="text-[13px] font-semibold text-app-muted">Carregando...</div>
          ) : error ? (
            <div className="text-[13px] font-semibold text-brand-red">{error}</div>
          ) : !rows.length ? (
            <div className="text-[13px] font-semibold text-app-muted">Sem dados.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 md:gap-3">
              {rows.map((r, idx) => (
                <div key={idx} className="rounded-xl border border-app-border bg-app-panel2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-extrabold text-app-text">{r.operador}</div>
                      <div className="mt-1 text-[12px] font-semibold text-app-muted">
                        Caixas: <span className="text-app-text tabular-nums">{r.caixas}</span> • Peças:{' '}
                        <span className="text-app-text tabular-nums">{r.pecas}</span>
                      </div>
                    </div>
                    <Kbd tone={r.erros === 0 ? 'success' : 'warning'}>{r.erros} erros</Kbd>
                  </div>
                  <div className="mt-2 text-[12px] font-semibold text-app-muted">
                    Tempo médio: <span className="text-app-text tabular-nums">{formatMmSs(r.tempoMedioSeg)}</span>
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

function formatMmSs(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
