/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#0B0E14',
          panel: '#111827',
          panel2: '#0F172A',
          border: 'rgba(148,163,184,0.14)',
          text: '#E5E7EB',
          muted: '#94A3B8',
        },
        brand: {
          primary: '#38BDF8',
          green: '#22C55E',
          red: '#EF4444',
          orange: '#F59E0B',
          blue: '#3B82F6',
        },
      },
      boxShadow: {
        panel: '0 18px 40px rgba(0,0,0,0.55)',
        soft: '0 10px 25px rgba(0,0,0,0.35)',
      },
      keyframes: {
        flash: {
          '0%': { opacity: '0' },
          '10%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        pulseGlow: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.7' },
          '50%': { transform: 'scale(1.02)', opacity: '1' },
        },
      },
      animation: {
        flash: 'flash 450ms ease-out',
        flashStrong: 'flash 650ms ease-out',
        pulseGlow: 'pulseGlow 1.2s ease-in-out infinite',
      },
      borderRadius: {
        xl: '18px',
      },
    },
  },
  plugins: [],
}
