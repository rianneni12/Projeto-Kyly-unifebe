import { useNavigate } from 'react-router-dom'
import { useApp } from '../app/context'
import { setCurrentBox } from '../app/storage'
import { Button, Card, CardBody, Header, Kbd, Screen } from '../app/ui'

export function MenuPage() {
  const nav = useNavigate()
  const { session, logout } = useApp()

  return (
    <Screen>
      <Header
        title="MENU PRINCIPAL"
        subtitle={
          session
            ? `Supervisor: ${session.supervisor.nome} • Operador: ${session.operador.nome}`
            : undefined
        }
        right={<Kbd tone="info">WMS</Kbd>}
      />

      <Card>
        <CardBody>
          <div className="grid gap-2 md:grid-cols-2 md:gap-3">
            <Button
              onClick={() => {
                nav('/caixa/abrir')
              }}
            >
              Iniciar Picking
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                nav('/caixa/reabrir')
              }}
            >
              Reabrir Caixa Aberta
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                nav('/historico')
              }}
            >
              Histórico
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                nav('/configuracoes')
              }}
            >
              Configurações
            </Button>

            {session?.role !== 'OPERADOR' ? (
              <Button
                variant="ghost"
                onClick={() => {
                  nav('/supervisor')
                }}
              >
                Supervisor
              </Button>
            ) : null}

            {session?.role === 'ADMIN' ? (
              <Button
                variant="ghost"
                onClick={() => {
                  nav('/admin')
                }}
              >
                Administrador
              </Button>
            ) : null}

            <div className="pt-2 md:col-span-2">
              <Button
                variant="danger"
                onClick={() => {
                  setCurrentBox(null)
                  logout()
                  nav('/', { replace: true })
                }}
              >
                Sair
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </Screen>
  )
}
