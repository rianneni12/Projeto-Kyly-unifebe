import clsx from 'clsx'
import type { ReactNode } from 'react'

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-app-bg text-app-text">
      <div className="mx-auto w-full max-w-[520px] px-4 pb-10 pt-6 md:max-w-[920px] md:px-8 lg:max-w-[1100px]">
        {children}
      </div>
    </div>
  )
}

export function Header({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 md:mb-5">
      <div className="min-w-0">
        <div className="text-[15px] font-semibold tracking-wide text-app-text md:text-[16px]">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-1 text-[12px] font-medium text-app-muted md:text-[13px]">
            {subtitle}
          </div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-app-border bg-app-panel shadow-panel',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="p-4 md:p-5">{children}</div>
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'lg',
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'warning' | 'success'
  size?: 'lg' | 'md'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const base =
    'w-full select-none rounded-xl font-semibold tracking-wide active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100'
  const sizes =
    size === 'lg' ? 'py-4 text-[15px]' : 'py-3 text-[14px] rounded-lg'
  const variants = {
    primary: 'bg-brand-primary text-slate-900 shadow-soft',
    ghost: 'bg-transparent text-app-text border border-app-border',
    danger: 'bg-brand-red text-white shadow-soft',
    warning: 'bg-brand-orange text-slate-900 shadow-soft',
    success: 'bg-brand-green text-slate-900 shadow-soft',
  }[variant]

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={clsx(base, sizes, variants)}
    >
      {children}
    </button>
  )
}

export function BigValue({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  tone?: 'default' | 'info' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-brand-green/30 bg-brand-green/10'
      : tone === 'warning'
        ? 'border-brand-orange/30 bg-brand-orange/10'
        : tone === 'info'
          ? 'border-brand-blue/30 bg-brand-blue/10'
          : 'border-app-border bg-app-panel2'

  return (
    <div className={clsx('rounded-xl border p-3', toneClass)}>
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
        {label}
      </div>
      <div className="mt-1 text-[20px] font-extrabold tracking-tight text-app-text md:text-[22px]">
        {value}
      </div>
    </div>
  )
}

export function ProgressBar({
  value,
  label,
}: {
  value: number
  label?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-app-muted">
        <div>{label ?? 'Progresso'}</div>
        <div className="tabular-nums">{v}%</div>
      </div>
      <div className="h-3 w-full rounded-full bg-app-panel2">
        <div
          className="h-3 rounded-full bg-brand-primary"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  )
}

export function Kbd({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'info' | 'success' | 'danger' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
      : tone === 'danger'
        ? 'border-brand-red/40 bg-brand-red/10 text-brand-red'
        : tone === 'warning'
          ? 'border-brand-orange/40 bg-brand-orange/10 text-brand-orange'
          : tone === 'info'
            ? 'border-brand-blue/40 bg-brand-blue/10 text-brand-blue'
            : 'border-app-border bg-app-panel2 text-app-muted'

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-lg border px-2 py-1 text-[12px] font-bold uppercase tracking-[0.12em]',
        toneClass,
      )}
    >
      {children}
    </span>
  )
}

export function Modal({
  open,
  title,
  children,
  actions,
}: {
  open: boolean
  title: string
  children: ReactNode
  actions: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6 pt-10">
      <div className="w-full max-w-[520px] rounded-xl border border-app-border bg-app-panel shadow-panel md:max-w-[720px]">
        <div className="px-4 pt-4 text-[14px] font-extrabold tracking-wide">
          {title}
        </div>
        <div className="px-4 pb-4 pt-2 text-[13px] font-medium text-app-muted">
          {children}
        </div>
        <div className="px-4 pb-4">{actions}</div>
      </div>
    </div>
  )
}

export function FlashOverlay({
  mode,
  strong,
}: {
  mode: 'none' | 'success' | 'error' | 'info' | 'warning'
  strong?: boolean
}) {
  if (mode === 'none') return null
  const bg =
    mode === 'success'
      ? 'bg-brand-green'
      : mode === 'error'
        ? 'bg-brand-red'
        : mode === 'warning'
          ? 'bg-brand-orange'
          : 'bg-brand-blue'
  const anim = strong ? 'animate-flashStrong' : 'animate-flash'
  return (
    <div className={clsx('pointer-events-none fixed inset-0 z-40 opacity-0', bg, anim)} />
  )
}
