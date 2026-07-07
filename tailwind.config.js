/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        'bg-base':      '#0d0d0d',
        'accent':       '#ff3333',
        'accent-deep':  '#990000',
        'card':         'rgba(26,26,26,0.7)',
        'text-muted':   '#a3a3a3',
        'success':      '#10b981',
      },
      fontFamily: {
        sans: ["'Outfit'", "'IBM Plex Sans Thai'", 'sans-serif'],
      },
      backdropBlur: {
        xs: '4px',
      },
      keyframes: {
        shimmer: {
          '0%':   { transform: 'translateX(-100%)', opacity: '0' },
          '50%':  { opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.1' },
        },
        'pulse-glow': {
          '0%':   { filter: 'drop-shadow(0 0 15px rgba(255,51,51,0.2))' },
          '100%': { filter: 'drop-shadow(0 0 25px rgba(153,0,0,0.4))' },
        },
        drift: {
          '0%':   { transform: 'translate(0,0) scale(1)' },
          '100%': { transform: 'translate(40px,30px) scale(1.08)' },
        },
        fadeSlideIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        titleGlow: {
          from: { filter: 'drop-shadow(0 0 15px rgba(255,51,51,0.3)) drop-shadow(0 0 30px rgba(255,51,51,0.1))' },
          to:   { filter: 'drop-shadow(0 0 30px rgba(255,51,51,0.6)) drop-shadow(0 0 60px rgba(255,51,51,0.3))' },
        },
        pulseBorder: {
          '0%':   { borderColor: 'rgba(255,255,255,0.1)' },
          '100%': { borderColor: 'rgba(255,51,51,0.3)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        shimmer:      'shimmer 2.5s ease-in-out infinite',
        blink:        'blink 1s step-end infinite',
        'pulse-glow': 'pulse-glow 1.5s infinite alternate',
        drift:        'drift 12s ease-in-out infinite alternate',
        'fade-in':    'fadeSlideIn 0.35s ease',
        'title-glow': 'titleGlow 3s ease-in-out infinite alternate',
        'pulse-border':'pulseBorder 2s infinite alternate',
        spin:         'spin 0.7s linear infinite',
      },
    },
  },
  plugins: [],
};
