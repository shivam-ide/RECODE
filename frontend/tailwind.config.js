/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'surface-base': '#0F0F0F',
        'surface-panel': '#181818',
        'surface-input': '#212121',
        'border-subtle': '#303030',
        'border-strong': '#3F3F3F',
        'text-primary': '#F1F1F1',
        'text-secondary': '#AAAAAA',
        'text-tertiary': '#717171',
        'code-cyan': '#02C8F0',
        'severity-critical': '#FF4D4D',
        'severity-high': '#FFA116',
        'severity-med': '#FFD600',
        'severity-low': '#78DFFF',
        'severity-clean': '#27C93F',
        surface: {
          base: '#0F0F0F',
          panel: '#181818',
          input: '#212121',
        },
        border: {
          subtle: '#303030',
          strong: '#3F3F3F',
        },
        text: {
          primary: '#F1F1F1',
          secondary: '#AAAAAA',
          tertiary: '#717171',
        },
        code: {
          cyan: '#02C8F0',
        },
        severity: {
          critical: '#FF4D4D',
          high: '#FFA116',
          med: '#FFD600',
          low: '#78DFFF',
          clean: '#27C93F',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
