import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/app/renderer/**/*.{html,ts,tsx}',
    './src/shared/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config;
