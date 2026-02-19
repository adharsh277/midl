import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bitcoin: {
          50: '#fffbf0',
          100: '#fef3e1',
          500: '#f7931a',
          600: '#e8860f',
          700: '#c9610d',
        },
      },
      backgroundImage: {
        gradient: 'linear-gradient(135deg, #f7931a 0%, #e8860f 100%)',
      },
    },
  },
  plugins: [],
}

export default config
