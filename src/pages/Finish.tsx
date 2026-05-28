import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../app/api'
import { audio, vibrateOkStrong } from '../app/audio'
import { useApp } from '../app/context'
import { setCurrentBox } from '../app/storage'
import { Button, Card, CardBody, FlashOverlay, Header, Kbd, Screen } from '../app/ui'

export function FinishPage() {
  const nav = useNavigate()
  const { box, setBox } = useApp()
  const [flash, setFlash] = useState<'none' | 'success' | 'warning'>('none')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!box) nav('/menu', { replace: true })
  }, [box])

  const stats = useMemo(() => {
    if (!box) return null
    const missing = box.itens.filter((i) => i.status === 'EM_FALTA').length
    const pending = box.itens.filter((i) => i.qtd_picked < i.qtd_requerida && i.status !== 'EM_FALTA')
      .length
    const done = pending === 0 && missing === 0
    return { missing, pending, done }
  }, [box])

  useEffect(() => {
    if (!box || !stats) return
    if (stats.done) {
      setFlash('success')
      audio.finish().catch(() => null)
      vibrateOkStrong()
      window.setTimeout(() => setFlash('none'), 850)
    } else {
      setFlash('warning')
      audio.warn().catch(() => null)
      window.setTimeout(() => setFlash('none'), 650)
    }
  }, [box?.id])

  if (!box || !stats) return null

  return (
    <Screen>
      <FlashOverlay mode={flash === 'success' ? 'success' : flash === 'warning' ? 'warning' : 'none'} strong />
      <Header
        title="FINALIZAÇÃO DE CAIXA"
        subtitle={`${box.papeleta} • ${box.pedido?.numeroPedido ?? ''}`}
        right={<Kbd tone={stats.done ? 'success' : 'warning'}>{stats.done ? 'OK' : 'PARCIAL'}</Kbd>}
      />

      <Card>
        <CardBody>
          {stats.done ? (
            <div className="rounded-xl border border-brand-green/30 bg-brand-green/10 p-4 text-center">
              <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand-green">
                CAIXA FINALIZADA
              </div>
              <div className="mt-2 text-[14px] font-semibold text-app-text">
                Todas as peças foram coletadas.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/10 p-4 text-center">
              <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand-orange">
                CAIXA COM PICKING PARCIAL
              </div>
              <div className="mt-2 text-[14px] font-semibold text-app-text">
                Pendentes: <span className="tabular-nums">{stats.pending}</span> • Em falta:{' '}
                <span className="tabular-nums">{stats.missing}</span>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-2">
            {stats.done ? (
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await api.finalizeBox({ boxId: box.id, mode: 'FINAL' })
                    setBox(null)
                    setCurrentBox(null)
                    nav('/menu', { replace: true })
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Confirmar
              </Button>
            ) : (
              <>
                <Button
                  variant="warning"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await api.finalizeBox({ boxId: box.id, mode: 'PARCIAL' })
                      setBox(null)
                      setCurrentBox(null)
                      nav('/menu', { replace: true })
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Salvar Parcial
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setBox(null)
                    setCurrentBox(null)
                    nav('/menu', { replace: true })
                  }}
                >
                  Continuar depois
                </Button>
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </Screen>
  )
}

