import { useEffect, useMemo, useRef, useState } from 'react'

export type ScannerState = {
  armed: boolean
  lastScan: string | null
  buffer: string
}

type Options = {
  onScan: (code: string) => void | Promise<void>
  autoDisarm?: boolean
}

export type ScannerHandle = {
  armed: boolean
  buffer: string
  lastScan: string | null
  arm: () => void
  disarm: () => void
  reset: () => void
  simulate: (code: string) => void
}

export function useScanner({ onScan, autoDisarm = true }: Options) {
  const [armed, setArmed] = useState(false)
  const [buffer, setBuffer] = useState('')
  const [lastScan, setLastScan] = useState<string | null>(null)
  const lastKeyAtRef = useRef<number>(0)
  const scanningRef = useRef(false)

  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const triggerScanRef = useRef<(code: string) => void>(() => {})
  triggerScanRef.current = (rawCode: string) => {
    const code = rawCode.trim()
    if (!code) return
    if (scanningRef.current) return
    scanningRef.current = true
    Promise.resolve(onScanRef.current(code)).finally(() => {
      setLastScan(code)
      setBuffer('')
      if (autoDisarm) setArmed(false)
      scanningRef.current = false
    })
  }

  useEffect(() => {
    if (!armed) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (!armed) return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        if ((target as any).isContentEditable) return
      }
      if (e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control') return

      const now = Date.now()
      const gap = now - lastKeyAtRef.current
      lastKeyAtRef.current = now

      if (gap > 220) setBuffer('')

      if (e.key === 'Enter') {
        triggerScanRef.current(buffer)
        e.preventDefault()
        return
      }

      if (e.key.length === 1) {
        setBuffer((prev) => prev + e.key)
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [armed, buffer, autoDisarm])

  return useMemo(
    (): ScannerHandle => ({
      armed,
      buffer,
      lastScan,
      arm: () => setArmed(true),
      disarm: () => setArmed(false),
      reset: () => {
        setBuffer('')
        setLastScan(null)
      },
      simulate: (code: string) => triggerScanRef.current(code),
    }),
    [armed, buffer, lastScan],
  )
}

export function ManualScanInput({
  scanner,
  label = 'Entrada manual (sem scanner)',
  placeholder = 'Digite o código e pressione ENTER',
}: {
  scanner: ScannerHandle
  label?: string
  placeholder?: string
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!scanner.armed) return
    window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }, [scanner.armed])

  if (!scanner.armed) return null

  return (
    <div className="mt-3 rounded-xl border border-app-border bg-app-panel2 p-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-app-muted">
        {label}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          const v = value.trim()
          if (!v) return
          setValue('')
          scanner.simulate(v)
        }}
        inputMode="text"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="mt-2 w-full rounded-xl border border-app-border bg-black/20 px-4 py-4 text-[16px] font-extrabold tracking-wide text-app-text outline-none focus:border-brand-primary/60"
        placeholder={placeholder}
      />
      <div className="mt-2 text-[12px] font-semibold text-app-muted">
        Dica: leitores “keyboard wedge” também funcionam aqui (o coletor digita e envia ENTER).
      </div>
    </div>
  )
}
