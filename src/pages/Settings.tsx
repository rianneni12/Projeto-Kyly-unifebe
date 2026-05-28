import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPrefSound, getPrefVibration, setPrefSound, setPrefVibration } from '../app/prefs'
import { Button, Card, CardBody, Header, Kbd, Screen } from '../app/ui'

export function SettingsPage() {
  const nav = useNavigate()
  const [sound, setSound] = useState(() => getPrefSound())
  const [vibration, setVibration] = useState(() => getPrefVibration())

  const device = useMemo(() => {
    const ua = navigator.userAgent
    const w = window.innerWidth
    const h = window.innerHeight
    return { ua, w, h }
  }, [])

  return (
    <Screen>
      <Header title="CONFIGURAÇÕES" subtitle="Preferências do coletor" right={<Kbd tone="info">CFG</Kbd>} />

      <Card>
        <CardBody>
          <div className="grid gap-2 md:grid-cols-2 md:gap-3">
            <ToggleRow
              label="Sons"
              value={sound}
              onChange={(v) => {
                setSound(v)
                setPrefSound(v)
              }}
            />
            <ToggleRow
              label="Vibração"
              value={vibration}
              onChange={(v) => {
                setVibration(v)
                setPrefVibration(v)
              }}
            />
          </div>

          <div className="mt-4 rounded-xl border border-app-border bg-app-panel2 p-3 md:mt-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
              Dispositivo
            </div>
            <div className="mt-2 text-[12px] font-semibold text-app-muted">
              Tela: <span className="text-app-text tabular-nums">{device.w}×{device.h}</span>
            </div>
            <div className="mt-2 break-all text-[11px] font-semibold text-app-muted">
              UA: <span className="text-app-text">{device.ua}</span>
            </div>
          </div>

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

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-xl border border-app-border bg-black/20 px-4 py-4 text-left"
    >
      <div className="text-[14px] font-extrabold tracking-wide text-app-text">{label}</div>
      <div
        className={
          value
            ? 'rounded-lg border border-brand-green/40 bg-brand-green/15 px-3 py-2 text-[12px] font-extrabold text-brand-green'
            : 'rounded-lg border border-app-border bg-app-panel2 px-3 py-2 text-[12px] font-extrabold text-app-muted'
        }
      >
        {value ? 'ATIVO' : 'DESLIGADO'}
      </div>
    </button>
  )
}
