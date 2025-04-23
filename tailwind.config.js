/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      fontFamily: {
        handwriting: ['cursive'],
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Libre Baskerville', 'ui-serif', 'Georgia', 'Cambria', 'serif'],
      },
      animation: {
        'pulse-slow': 'pulse-slow 8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.8, transform: 'scale(0.98)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      },
      colors: {
        cream: {
          50: '#fffefb',
          100: '#f8f6f0',
          200: '#f5f2e9',
          300: '#e8e4d5',
          400: '#d1cdc0',
          500: '#b8b2a2',
          600: '#a39b8a',
          700: '#8c8575',
          800: '#6a6559',
          900: '#4d4940',
        },
        noir: {
          900: '#000000',
          800: '#1a1a1a',
          700: '#333333',
          600: '#4a4a4a',
          500: '#666666',
          400: '#888888',
          300: '#aaaaaa',
          200: '#cccccc',
          100: '#eeeeee',
          50: '#f8f8f8',
        }
      },
      boxShadow: {
        'soft-cream': '0 4px 14px 0 rgba(209, 205, 192, 0.3)',
        'elegant': '0 6px 20px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio'),
  ],
}

