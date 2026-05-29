import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../app/api'
import { audio, vibrateError, vibrateOk, vibrateOkStrong } from '../app/audio'
import { useApp } from '../app/context'
import { ManualScanInput, useScanner } from '../app/scanner'
import type { BoxView, PickingScanResult } from '../app/types'
import { BigValue, Button, Card, CardBody, FlashOverlay, Header, Kbd, Modal, ProgressBar, Screen } from '../app/ui'

type Flash = { mode: 'none' | 'success' | 'error' | 'info' | 'warning'; strong?: boolean }

export function PickingPage() {
  const nav = useNavigate()
  const { box, setBox } = useApp()
  const [flash, setFlash] = useState<Flash>({ mode: 'none' })
  const [statusLine, setStatusLine] = useState<string>('Pressione Bipar e leia a peça.')
  const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; msg: string }>({
    open: false,
    title: '',
    msg: '',
  })
  const [faltandoModal, setFaltandoModal] = useState<{ open: boolean; step: 'ASK' | 'TABLE'; alternatives: any[] }>({
    open: false,
    step: 'ASK',
    alternatives: [],
  })
  const isDev = import.meta.env.DEV

  useEffect(() => {
    if (!box) nav('/caixa/abrir', { replace: true })
  }, [box])

  const item = box?.itemAtual ?? null

  const totalDone = useMemo(() => {
    if (!box) return false
    return box.itens.every((i) => i.status === 'CONCLUIDO' || i.status === 'EM_FALTA' || i.qtd_picked >= i.qtd_requerida)
  }, [box])

  useEffect(() => {
    if (!box) return
    if (!box.itemAtual && totalDone) nav('/caixa/finalizar', { replace: true })
  }, [box?.itemAtual, totalDone])

  const scanner = useScanner({
    onScan: async (code) => {
      if (!box) return
      const normalized = (() => {
        const c = code.trim().toUpperCase()
        if (c.includes('1000080')) return c.replace('1000080', '1000123')
        const m = c.match(/(\d{7})/)
        if (m && (c === m[1] || c.startsWith('SKU'))) {
          return `${m[1]}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        }
        return code.trim()
      })()
      setFlash({ mode: 'none' })
      setStatusLine('Processando bipagem...')
      try {
        const r = (await api.scanPiece({ boxId: box.id, code: normalized })) as PickingScanResult
        const newBox = r.box as BoxView
        setBox(newBox)

        if (r.result === 'SKU_CONCLUIDA') {
          setFlash({ mode: 'success', strong: true })
          setStatusLine('SKU concluída. Próximo endereço carregado.')
          await audio.okDouble()
          vibrateOkStrong()
          window.setTimeout(() => setFlash({ mode: 'none' }), 700)
        } else {
          setFlash({ mode: 'success' })
          setStatusLine('Peça correta. Quantidade parcial atualizada.')
          await audio.okSingle()
          vibrateOk()
          window.setTimeout(() => setFlash({ mode: 'none' }), 450)
        }
      } catch (e) {
        setFlash({ mode: 'error', strong: true })
        await audio.error()
        vibrateError()
        const msg = e instanceof Error ? e.message : 'Erro na bipagem.'
        setStatusLine(msg)
        setErrorModal({
          open: true,
          title: 'BIPAGEM INVÁLIDA',
          msg,
        })
        window.setTimeout(() => setFlash({ mode: 'none' }), 700)
      }
    },
  })

  if (!box || !item) {
    return (
      <Screen>
        <Header title="PICKING" subtitle="Carregando..." />
        <Card>
          <CardBody>
            <div className="text-[13px] font-semibold text-app-muted">Nenhum item em coleta.</div>
            <div className="mt-3">
              <Button variant="ghost" onClick={() => nav('/menu')}>
                Voltar ao menu
              </Button>
            </div>
          </CardBody>
        </Card>
      </Screen>
    )
  }

  const qtdFalta = Math.max(0, item.qtd_requerida - item.qtd_picked)

  return (
    <Screen>
      <FlashOverlay mode={flash.mode} strong={flash.strong} />
      <Header
        title="PICKING"
        subtitle={`${box.papeleta} • ${box.pedido?.numeroPedido ?? ''}`}
        right={<Kbd tone={scanner.armed ? 'success' : 'warning'}>{scanner.armed ? 'LASER ON' : 'LASER OFF'}</Kbd>}
      />

      <Card>
        <CardBody>
          <ProgressBar value={box.progresso} label="Coleta total" />
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <div className="md:col-span-2">
              <BigValue label="ENDEREÇO" value={item.endereco} tone="info" />
            </div>
            <BigValue label="REFERÊNCIA" value={item.skuRef} />
            <BigValue label="COR" value={item.cor} />
            <BigValue label="TAMANHO" value={item.tamanho} />
            <BigValue
              label="QUANTIDADE"
              value={
                <span className="tabular-nums">
                  {item.qtd_picked}/{item.qtd_requerida}
                </span>
              }
              tone={qtdFalta === 0 ? 'success' : 'warning'}
            />
          </div>

          <div className="mt-4 rounded-xl border border-app-border bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
                Status
              </div>
              <Kbd tone="info">Scanner</Kbd>
            </div>
            <div className="mt-1 text-[13px] font-semibold text-app-text">{statusLine}</div>
            <div className="mt-3 grid gap-2">
              <Button
                variant={scanner.armed ? 'warning' : 'primary'}
                onClick={() => {
                  if (scanner.armed) scanner.disarm()
                  else scanner.arm()
                }}
              >
                {scanner.armed ? 'Cancelar bipagem' : 'Bipar'}
              </Button>

              <ManualScanInput
                scanner={scanner}
                label="Entrada manual (modo teste)"
                placeholder="Ex.: SKU1000079"
              />
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <Button
              variant="warning"
              onClick={() => {
                setFaltandoModal({ open: true, step: 'ASK', alternatives: [] })
              }}
            >
              Retirar Item em Falta
            </Button>
            <Button variant="ghost" onClick={() => nav('/menu')}>
              Menu
            </Button>
          </div>
        </CardBody>
      </Card>

      {isDev ? (
        <Card className="mt-4">
          <CardBody>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
              Códigos de teste disponíveis
            </div>
            <div className="mt-2 grid gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  scanner.arm()
                  window.setTimeout(() => scanner.simulate('SKU1000079'), 0)
                }}
              >
                Bipar peça demo: SKU1000079
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  scanner.arm()
                  window.setTimeout(() => scanner.simulate('SKU1000080'), 0)
                }}
              >
                Bipar peça demo: SKU1000080
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  scanner.arm()
                  window.setTimeout(() => scanner.simulate('SKU1000081'), 0)
                }}
              >
                Bipar peça demo: SKU1000081
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Modal
        open={errorModal.open}
        title={errorModal.title}
        actions={
          <Button
            onClick={() => {
              setErrorModal({ open: false, title: '', msg: '' })
              setStatusLine('Pressione Bipar e leia a peça.')
            }}
          >
            Continuar
          </Button>
        }
      >
        {errorModal.msg}
      </Modal>

      <Modal
        open={faltandoModal.open && faltandoModal.step === 'ASK'}
        title="ITEM EM FALTA"
        actions={
          <div className="grid gap-2">
            <Button
              onClick={async () => {
                const r = (await api.markMissing({ boxId: box.id, itemId: item.id })) as {
                  box: BoxView
                  alternatives: any[]
                }
                setBox(r.box)
                setFaltandoModal({ open: true, step: 'TABLE', alternatives: r.alternatives })
                setFlash({ mode: 'warning' })
                await audio.warn()
                window.setTimeout(() => setFlash({ mode: 'none' }), 650)
              }}
            >
              SIM — Visualizar outros endereços
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                const r = (await api.markMissing({ boxId: box.id, itemId: item.id })) as {
                  box: BoxView
                  alternatives: any[]
                }
                setBox(r.box)
                setFaltandoModal({ open: false, step: 'ASK', alternatives: [] })
                setFlash({ mode: 'warning' })
                await audio.warn()
                window.setTimeout(() => setFlash({ mode: 'none' }), 650)
              }}
            >
              NÃO — Continuar sem listar
            </Button>
          </div>
        }
      >
        Deseja visualizar outros endereços?
      </Modal>

      <Modal
        open={faltandoModal.open && faltandoModal.step === 'TABLE'}
        title="LOCALIZAÇÕES ALTERNATIVAS"
        actions={
          <Button
            onClick={() => {
              setFaltandoModal({ open: false, step: 'ASK', alternatives: [] })
            }}
          >
            Fechar
          </Button>
        }
      >
        <AlternativesTable alternatives={faltandoModal.alternatives} current={item.endereco} />
      </Modal>
    </Screen>
  )
}

function AlternativesTable({
  alternatives,
  current,
}: {
  alternatives: Array<{ endereco?: unknown; qtdDisponivel?: unknown }>
  current: string
}) {
  if (!alternatives.length) {
    return (
      <div className="text-[13px] font-semibold text-app-muted">
        Nenhum endereço alternativo com saldo (diferente de {current}).
      </div>
    )
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-app-border">
      <div className="grid grid-cols-2 bg-app-panel2 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-app-muted">
        <div>Endereço</div>
        <div className="text-right">Qtd</div>
      </div>
      {alternatives.map((a, idx) => (
        <div
          key={idx}
          className="grid grid-cols-2 border-t border-app-border px-3 py-2 text-[13px] font-semibold"
        >
          <div className="text-app-text">{String(a.endereco ?? '')}</div>
          <div className="text-right tabular-nums text-app-muted">
            {String(a.qtdDisponivel ?? '')}
          </div>
        </div>
      ))}
    </div>
  )
}
