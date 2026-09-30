/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#070707',
          900: '#0D0D0E',
          850: '#141414',
          800: '#1B1B1C',
          700: '#2A2A2B',
        },
        graphite: {
          900: '#151514',
          800: '#22201C',
          700: '#343029',
          600: '#4C463B',
        },
        gold: {
          700: '#8C5E12',
          600: '#B5822C',
          500: '#D6A84F',
          400: '#E4BF6A',
          300: '#F1D58A',
          200: '#F8E8B8',
        },
        champagne: {
          100: '#FFF8EA',
          200: '#F6EBD3',
          300: '#E8D8B5',
        },
        ink: {
          950: '#11100D',
          800: '#2A251D',
          600: '#665B46',
          400: '#A59675',
          200: '#D8CAAA',
        },
        success: { 100: '#E8F6DD', 700: '#3F7A2A' },
        warning: { 100: '#FFF0C9', 700: '#906100' },
        danger: { 100: '#FFE2D9', 700: '#9D2A20' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        lift: '0 18px 45px rgba(17, 16, 13, 0.14)',
      },
    },
  },
  plugins: [],
};
