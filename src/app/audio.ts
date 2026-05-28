type Beep = { freq: number; ms: number; gapMs?: number }

let ctx: AudioContext | null = null
let soundEnabled = true
let vibrationEnabled = true

function syncPrefs() {
  try {
    const s = localStorage.getItem('kyly.pref.sound')
    soundEnabled = s === null ? true : s === '1'
    const v = localStorage.getItem('kyly.pref.vibration')
    vibrationEnabled = v === null ? true : v === '1'
  } catch {
    soundEnabled = true
    vibrationEnabled = true
  }
}

function getCtx() {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

async function ensureRunning() {
  const c = getCtx()
  if (c.state !== 'running') await c.resume()
}

async function playSequence(seq: Beep[]) {
  syncPrefs()
  if (!soundEnabled) return
  await ensureRunning()
  const c = getCtx()
  let t = c.currentTime + 0.01
  for (const s of seq) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'square'
    osc.frequency.value = s.freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + s.ms / 1000)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(t)
    osc.stop(t + s.ms / 1000 + 0.02)
    t += s.ms / 1000 + (s.gapMs ?? 80) / 1000
  }
}

export const audio = {
  okSingle: () => playSequence([{ freq: 980, ms: 70 }]),
  okDouble: () => playSequence([{ freq: 980, ms: 70, gapMs: 70 }, { freq: 980, ms: 70 }]),
  error: () => playSequence([{ freq: 220, ms: 1900 }]),
  finish: () =>
    playSequence([
      { freq: 880, ms: 90, gapMs: 60 },
      { freq: 1175, ms: 110, gapMs: 60 },
      { freq: 1568, ms: 140 },
    ]),
  warn: () => playSequence([{ freq: 520, ms: 130, gapMs: 90 }, { freq: 520, ms: 130 }]),
}

export function vibrateOk() {
  syncPrefs()
  if (!vibrationEnabled) return
  if (!('vibrate' in navigator)) return
  navigator.vibrate(35)
}

export function vibrateOkStrong() {
  syncPrefs()
  if (!vibrationEnabled) return
  if (!('vibrate' in navigator)) return
  navigator.vibrate([35, 40, 35])
}

export function vibrateError() {
  syncPrefs()
  if (!vibrationEnabled) return
  if (!('vibrate' in navigator)) return
  navigator.vibrate(700)
}
