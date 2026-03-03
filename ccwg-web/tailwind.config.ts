import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          primary:   'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary:  'var(--bg-tertiary)',
          panel:     'var(--bg-panel)',
          card:      'var(--bg-card)',
        },
        accent: {
          DEFAULT: 'var(--accent-primary)',
          orange:  'var(--accent-orange)',
          red:     'var(--accent-red)',
          purple:  'var(--accent-purple)',
        },
        // Legacy purple scale — preserved for existing components
        primary: {
          DEFAULT: '#8b5cf6',
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
        gray: {
          850: '#1a1a1a',
          950: '#0a0a0a',
        },
      },
      fontFamily: {
        display:  ['var(--font-orbitron)', 'Orbitron', 'monospace'],
        tactical: ['var(--font-rajdhani)', 'Rajdhani', 'sans-serif'],
        sans:     ['var(--font-inter)', 'Inter', 'Arial', 'Helvetica', 'sans-serif'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow':  'pulse-glow 2s ease-in-out infinite',
        'pulse-cyan':  'pulse-cyan 2.5s ease-in-out infinite',
        'fade-in':     'fade-in 0.4s ease forwards',
        'slide-down':  'slide-down 0.35s ease forwards',
        'loading-bar': 'loading-bar 3.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards',
        'hud-flicker': 'hud-flicker 8s ease infinite',
      },
      boxShadow: {
        'glow-accent':  '0 0 20px var(--accent-primary-glow), 0 0 40px var(--accent-primary-glow)',
        'glow-orange':  '0 0 20px var(--accent-orange-glow)',
        'glow-red':     '0 0 16px var(--accent-red-glow)',
        'hud':          '0 0 0 1px var(--border-accent), 0 0 12px var(--hud-glow)',
      },
    },
  },
  plugins: [],
};

export default config;