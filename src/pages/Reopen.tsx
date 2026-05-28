import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../app/api'
import { audio, vibrateError, vibrateOk } from '../app/audio'
import { useApp } from '../app/context'
import { ManualScanInput, useScanner } from '../app/scanner'
import type { BoxView } from '../app/types'
import { Button, Card, CardBody, FlashOverlay, Header, Kbd, ProgressBar, Screen } from '../app/ui'

export function ReopenPage() {
  const nav = useNavigate()
  const { setBox } = useApp()
  const [flash, setFlash] = useState<'none' | 'success' | 'error' | 'info'>('none')
  const [status, setStatus] = useState<string>('Bipe a papeleta para reabrir.')
  const [papeleta, setPapeleta] = useState<string>('')
  const [boxView, setBoxView] = useState<BoxView | null>(null)
  const isDev = import.meta.env.DEV

  async function reopenWith(code: string) {
    setPapeleta(code)
    setStatus('Buscando caixa...')
    try {
      const apiCode =
        code.trim().toUpperCase() === 'CX123456' ? 'CX-2026-000189' : code.trim()
      const b = (await api.openBox({ papeletaCode: apiCode })) as BoxView
      setBoxView(b)
      if (b.status !== 'ABERTA') {
        await audio.error()
        vibrateError()
        setFlash('error')
        setStatus('A caixa não está aberta (status: ' + b.status + ').')
        window.setTimeout(() => setFlash('none'), 650)
        return
      }

      setBox(b)
      await audio.okSingle()
      vibrateOk()
      setFlash('success')
      setStatus('Caixa reaberta. Pronto para retomar.')
      window.setTimeout(() => setFlash('none'), 450)
    } catch (e) {
      await audio.error()
      vibrateError()
      setFlash('error')
      setStatus(e instanceof Error ? e.message : 'Falha ao reabrir.')
      window.setTimeout(() => setFlash('none'), 650)
    }
  }

  const scanner = useScanner({
    onScan: async (code) => {
      await reopenWith(code)
    },
  })

  return (
    <Screen>
      <FlashOverlay mode={flash} />
      <Header title="REABRIR CAIXA" subtitle="Retomar do ponto salvo" right={<Kbd tone="info">RETOMAR</Kbd>} />

      <div className="grid gap-3 md:grid-cols-2 md:items-start">
        <Card>
          <CardBody>
            <div className="rounded-xl border border-app-border bg-app-panel2 p-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
                Papeleta
              </div>
              <div className="mt-1 break-all text-[18px] font-extrabold tracking-tight">
                {papeleta || '—'}
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-app-border bg-black/20 p-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
                Status
              </div>
              <div className="mt-1 text-[13px] font-semibold text-app-text">{status}</div>
            </div>

            <div className="mt-4 grid gap-2">
              <Button
                variant={scanner.armed ? 'warning' : 'primary'}
                onClick={() => {
                  if (scanner.armed) scanner.disarm()
                  else scanner.arm()
                }}
              >
                {scanner.armed ? 'Cancelar bipagem' : 'Bipar'}
              </Button>

              <ManualScanInput scanner={scanner} label="Entrada manual (modo teste)" placeholder="Ex.: CX123456" />

              <Button
                variant="ghost"
                onClick={() => {
                  void reopenWith('CX123456')
                }}
              >
                Usar dados demo
              </Button>
            </div>
          </CardBody>
        </Card>

        {boxView ? (
          <div className="grid gap-3">
            <Card>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-app-muted">
                      Caixa
                    </div>
                    <div className="mt-1 break-all text-[16px] font-extrabold">
                      {boxView.papeleta}
                    </div>
                    {boxView.pedido ? (
                      <div className="mt-1 text-[12px] font-semibold text-app-muted">
                        {boxView.pedido.numeroPedido} • {boxView.pedido.cliente}
                      </div>
                    ) : null}
                  </div>
                  <Kbd tone="success">{boxView.status}</Kbd>
                </div>
                <div className="mt-4">
                  <ProgressBar value={boxView.progresso} label="Progresso" />
                </div>
              </CardBody>
            </Card>

            <Button
              disabled={boxView.status !== 'ABERTA'}
              onClick={() => {
                nav('/picking')
              }}
            >
              Retomar Coleta
            </Button>
          </div>
        ) : (
          <div className="hidden md:block" />
        )}
      </div>

      <div className="mt-4">
        <Button variant="ghost" onClick={() => nav('/menu')}>
          Voltar ao menu
        </Button>
      </div>

      {isDev ? (
        <div className="mt-4 rounded-xl border border-app-border bg-black/20 p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
            Códigos de teste disponíveis
          </div>
          <div className="mt-2 text-[12px] font-semibold text-app-muted">
            Caixa: <span className="text-app-text">CX123456</span>
          </div>
        </div>
      ) : null}
    </Screen>
  )
}
