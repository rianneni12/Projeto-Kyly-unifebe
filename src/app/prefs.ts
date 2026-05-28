const k = {
  sound: 'kyly.pref.sound',
  vibration: 'kyly.pref.vibration',
} as const

export function getPrefSound(): boolean {
  const v = localStorage.getItem(k.sound)
  if (v === null) return true
  return v === '1'
}

export function setPrefSound(v: boolean) {
  localStorage.setItem(k.sound, v ? '1' : '0')
}

export function getPrefVibration(): boolean {
  const v = localStorage.getItem(k.vibration)
  if (v === null) return true
  return v === '1'
}

export function setPrefVibration(v: boolean) {
  localStorage.setItem(k.vibration, v ? '1' : '0')
}

