import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../app/api'
import { setSessionToken } from '../app/storage'
import { useApp } from '../app/context'
import { audio, vibrateError, vibrateOk } from '../app/audio'
import { ManualScanInput, useScanner } from '../app/scanner'
import { Button, Card, CardBody, FlashOverlay, Header, Kbd, Screen } from '../app/ui'
import type { SessionMe } from '../app/types'

type Step = 'SUPERVISOR' | 'OPERADOR'

export function LoginPage() {
  const nav = useNavigate()
  const { refreshMe } = useApp()
  const [step, setStep] = useState<Step>('SUPERVISOR')
  const [supervisorCode, setSupervisorCode] = useState('')
  const [operatorCode, setOperatorCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'validating' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState<string>('Bipe o código do supervisor.')
  const [flash, setFlash] = useState<'none' | 'success' | 'error' | 'info'>('none')

  const canEnter = status === 'ok'
  const isDev = import.meta.env.DEV

  async function loginWith(supervisor: string, operador: string) {
    setFlash('none')
    setSupervisorCode(supervisor)
    setOperatorCode(operador)
    setStatus('validating')
    setMessage('Validando...')
    try {
      const supervisorApi =
        supervisor.trim().toUpperCase() === 'SUP001' ? 'SUP-0001' : supervisor.trim()
      const operadorApi =
        operador.trim().toUpperCase() === 'USER001' ? 'OP-010' : operador.trim()
      const login = await api.login({ supervisorCode: supervisorApi, operatorCode: operadorApi })
      setSessionToken(login.token)
      await refreshMe()
      await audio.okSingle()
      vibrateOk()
      setStatus('ok')
      setMessage('Identificação concluída.')
      setFlash('success')
      window.setTimeout(() => setFlash('none'), 450)
      nav('/menu', { replace: true })
    } catch (e) {
      await audio.error()
      vibrateError()
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'Falha ao validar.')
      setFlash('error')
      window.setTimeout(() => setFlash('none'), 650)
    }
  }

  const scanner = useScanner({
    onScan: async (code) => {
      setFlash('none')
      if (step === 'SUPERVISOR') {
        setSupervisorCode(code)
        setStep('OPERADOR')
        setMessage('Bipe o crachá do colaborador.')
        setFlash('info')
        window.setTimeout(() => setFlash('none'), 350)
        return
      }

      await loginWith(supervisorCode, code)
    },
  })

  const helper = useMemo(() => {
    if (scanner.armed) return { label: 'Laser habilitado', tone: 'success' as const }
    if (step === 'SUPERVISOR') return { label: 'Aguardando supervisor', tone: 'info' as const }
    return { label: 'Aguardando colaborador', tone: 'warning' as const }
  }, [scanner.armed, step])

  return (
    <Screen>
      <FlashOverlay mode={flash} />
      <Header title="LOGIN DO COLETOR" subtitle="Identificação por bipagem (scanner keyboard wedge)" />

      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-2">
            <Kbd tone={helper.tone}>{helper.label}</Kbd>
            <div className="text-[12px] font-bold text-app-muted">
              {step === 'SUPERVISOR' ? 'SUPERVISOR' : 'COLABORADOR'}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-app-border bg-app-panel2 p-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
                Supervisor
              </div>
              <div className="mt-1 break-all text-[16px] font-extrabold tracking-tight">
                {supervisorCode || '—'}
              </div>
            </div>

            <div className="rounded-xl border border-app-border bg-app-panel2 p-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
                Colaborador
              </div>
              <div className="mt-1 break-all text-[16px] font-extrabold tracking-tight">
                {operatorCode || '—'}
              </div>
            </div>

            <div className="rounded-xl border border-app-border bg-black/20 p-3 md:col-span-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
                Status
              </div>
              <div className="mt-1 text-[13px] font-semibold text-app-text">{message}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <Button
              variant={scanner.armed ? 'warning' : 'primary'}
              onClick={() => {
                if (scanner.armed) scanner.disarm()
                else scanner.arm()
              }}
            >
              {scanner.armed ? 'Cancelar bipagem' : 'Bipar'}
            </Button>

            <div className="md:col-span-2">
              <ManualScanInput
                scanner={scanner}
                label="Entrada manual (modo teste)"
                placeholder={step === 'SUPERVISOR' ? 'Ex.: SUP001' : 'Ex.: USER001'}
              />
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                void loginWith('SUP001', 'USER001')
              }}
            >
              Usar dados demo
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                setStatus('idle')
                setSupervisorCode('')
                setOperatorCode('')
                setStep('SUPERVISOR')
                setMessage('Bipe o código do supervisor.')
                scanner.reset()
              }}
            >
              Limpar
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-2">
        <Button
          disabled={!canEnter}
          onClick={async () => {
            try {
              const me = (await api.me()) as SessionMe
              setSessionToken(me.token)
              nav('/menu', { replace: true })
            } catch {
              setStatus('error')
              setMessage('Sessão expirou. Faça o login novamente.')
            }
          }}
        >
          Entrar
        </Button>
      </div>

      {isDev ? (
        <div className="mt-4 rounded-xl border border-app-border bg-black/20 p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
            Códigos de teste disponíveis
          </div>
          <div className="mt-2 text-[12px] font-semibold text-app-muted">
            Supervisor: <span className="text-app-text">SUP001</span>
          </div>
          <div className="mt-1 text-[12px] font-semibold text-app-muted">
            Colaborador: <span className="text-app-text">USER001</span>
          </div>
        </div>
      ) : null}
    </Screen>
  )
}
